import {afterAll, beforeAll, describe, expect} from "vitest";
import {
    VIR_ENV_GID,
    VIR_ENV_HOSTNAME,
    VIR_ENV_UID,
    VIR_ENV_USER,
    VIR_ENV_USER_PATH
} from "../../../../../src/constants";
import {BashCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/BashCommand";
import {isPageSoftDeleted} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";
import {LogseqReversibleTransactionTrackerSerializer as Serializer} from "../../../../../src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionTrackerSerializer";
import {CommandFileStore} from "../../../../../src/core/stores/command-file-store/CommandFileStore";
import {ToolResultStore} from "../../../../../src/core/stores/tool-results/ToolResultStore";
import {LogseqPluginStorageManager as Storage} from "../../../../../src/logseq/LogseqPluginStorageManager";
import {deletePagePermanently} from "../../../../helpers/logseq/deletePagePermanently";
import {test} from "./fixtures/bashCommandFixture";

const WORKER_TIMEOUT = 180_000;
const REPLAY_PAGE = "test-bash-command-recorded-replay";
const FAILURE_PAGE = "test-bash-command-caught-failure";
const PYTHON_PACKAGE_OUTPUT = "Loading micropip\nLoaded micropip\n";
const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const pythonCommand = (source: string) => `python -c ${shellQuote(source)}`;
const commandMarkdown = (name: string, body: string) =>
    `---\nname: ${name}\ninvoke-location:\n  - Logseq Command Center\n---\n${body}`;

describe("BashCommand production Python execution", () => {
    for (const [source, exitCode] of [
        ["pass", 0],
        ["raise SystemExit()", 0],
        ["raise SystemExit(3)", 3],
        ["raise SystemExit(-2)", -2],
        ["raise SystemExit('message')", 1]
    ] as const)
        test(
            `preserves Python exit semantics: ${source}`,
            async ({sandbox}) => {
                const {tracker} = sandbox.createCommand(pythonCommand(source));
                expect(await tracker.execute()).toEqual({
                    stdout: PYTHON_PACKAGE_OUTPUT,
                    stderr: exitCode === 1 ? "message\n" : "",
                    exitCode
                });
            },
            WORKER_TIMEOUT
        );

    test("returns shell output inline and preserves nonzero exit data", async ({sandbox}) => {
        expect(await sandbox.createCommand("echo hi").tracker.execute()).toEqual({
            stdout: "hi\n",
            stderr: "",
            exitCode: 0
        });
        expect(await sandbox.createCommand("exit 3").tracker.execute()).toEqual({
            stdout: "",
            stderr: "",
            exitCode: 3
        });
    });

    test(
        "uses the shared Python identity and leaves reads nonmutating",
        async ({sandbox, inputPath}) => {
            const {tracker} = sandbox.createCommand(
                pythonCommand(`
import getpass, json, os, platform, socket
assert os.environ['HOME'] == '${VIR_ENV_USER_PATH}'
assert os.environ['USER'] == '${VIR_ENV_USER}'
assert getpass.getuser() == '${VIR_ENV_USER}'
assert socket.gethostname() == '${VIR_ENV_HOSTNAME}'
assert platform.node() == '${VIR_ENV_HOSTNAME}'
assert os.getuid() == ${VIR_ENV_UID}
assert os.getgid() == ${VIR_ENV_GID}
assert json.load(open('${inputPath}')) == {'value': 2}
print(os.getcwd())
`),
                `${VIR_ENV_USER_PATH}/tool-results`
            );
            expect(await tracker.execute()).toEqual({
                stdout: `${PYTHON_PACKAGE_OUTPUT}${VIR_ENV_USER_PATH}/tool-results\n`,
                stderr: "",
                exitCode: 0
            });
            expect(tracker.hasAppliedGraphMutations()).toBe(false);
            expect(tracker.getGraphMutationCommandCount()).toBe(0);
            expect(tracker.getChangedPages()).toEqual([]);
            expect(tracker.getChangedAssets()).toEqual([]);
            await tracker.revertAppliedCommands();
            expect(tracker.getAppliedCommandCount()).toBe(0);
        },
        WORKER_TIMEOUT
    );

    test(
        "executes mounted scripts with top-level await, escaped arguments and environment",
        async ({sandbox}) => {
            const name = "quote'café.py";
            const path = `${VIR_ENV_USER_PATH}/tool-results/${name}`;
            await Storage.saveFile(
                ToolResultStore.groupName,
                name,
                `#!/usr/bin/env python
import asyncio, os, sys
await asyncio.sleep(0)
assert __name__ == '__main__'
assert __file__ == sys.argv[0]
assert sys.argv[1:] == ['001', '😀', 'line\\nvalue', '--help', '']
assert os.environ['UNICODE_VALUE'] == "café\\n'\\\\"
print('ok😀')
`
            );
            const command = `export UNICODE_VALUE=${shellQuote("café\n'\\")}; python ${shellQuote(path)} ${["001", "😀", "line\nvalue", "--help", ""].map(shellQuote).join(" ")}`;
            expect(await sandbox.createCommand(command).tracker.execute()).toEqual({
                stdout: `${PYTHON_PACKAGE_OUTPUT}ok😀\n`,
                stderr: "",
                exitCode: 0
            });
        },
        WORKER_TIMEOUT
    );

    test("distinguishes piped program input from stdin source", async ({sandbox}) => {
        const input = `printf 'café😀\\n' | ${pythonCommand("print(input())")}`;
        expect(await sandbox.createCommand(input).tracker.execute()).toEqual({
            stdout: `${PYTHON_PACKAGE_OUTPUT}café😀\n`,
            stderr: "",
            exitCode: 0
        });
        expect(
            await sandbox.createCommand("python - <<'PY'\nprint('source😀')\nPY").tracker.execute()
        ).toEqual({
            stdout: `${PYTHON_PACKAGE_OUTPUT}source😀\n`,
            stderr: "",
            exitCode: 0
        });
    }, 360_000);

    test(
        "retains the user script filename in exception output",
        async ({sandbox}) => {
            const name = "quote'café.py";
            await Storage.saveFile(
                ToolResultStore.groupName,
                name,
                "raise ValueError('user failure')"
            );
            const result = await sandbox
                .createCommand(`python ${shellQuote(`${VIR_ENV_USER_PATH}/tool-results/${name}`)}`)
                .tracker.execute();
            expect(result).toMatchObject({exitCode: 1});
            expect(result.stderr).toContain("user failure");
            expect(result.stderr).toContain(name);
        },
        WORKER_TIMEOUT
    );

    for (const bypass of [false, true])
        test(
            `does not persist shared writes (chmod bypass: ${bypass})`,
            async ({sandbox, inputPath}) => {
                const source = `import os\n${bypass ? `os.chmod('${inputPath}', 0o666)\n` : ""}open('${inputPath}', 'w').write('changed')`;
                const result = await sandbox.createCommand(pythonCommand(source)).tracker.execute();
                expect(result.exitCode).toBe(1);
                expect(result.stderr).toContain(
                    bypass
                        ? "shared filesystem is read-only; use logseq_lib for changes"
                        : "PermissionError"
                );
                expect(await Storage.getFileContent(ToolResultStore.groupName, "input.json")).toBe(
                    '{"value":2}'
                );
            },
            WORKER_TIMEOUT
        );

    test("retains both workers' successful changes after a Python error and restores the baseline", async ({
        sandbox
    }) => {
        const baseline = commandMarkdown("Example", "baseline");
        const first = commandMarkdown("Example", "first");
        const second = commandMarkdown("Example", "second");
        await CommandFileStore.saveCommandFile(baseline);
        const save = (content: string) =>
            `await logseq_lib.save_command_file(${JSON.stringify({commandName: "Example", content})})`;
        const {bash, tracker} = sandbox.createCommand(
            [
                pythonCommand(`import logseq_lib\n${save(first)}`),
                pythonCommand(
                    `import logseq_lib\nassert (await logseq_lib.read_command_file({'commandName': 'Example'}))['content'] == ${JSON.stringify(first)}\n${save(second)}\nprint('before failure')\nraise ValueError('deliberate failure')`
                )
            ].join("; ")
        );
        const result = await tracker.execute();
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toBe(`${PYTHON_PACKAGE_OUTPUT.repeat(2)}before failure\n`);
        expect(result.stderr).toContain("deliberate failure");
        expect(bash.getCommands().map((command) => command.constructor.name)).toEqual([
            "PutCommandFileCommand",
            "ReadCommandFileCommand",
            "PutCommandFileCommand"
        ]);
        expect((await CommandFileStore.getCommandFileByName("Example"))?.content).toBe(second);
        await tracker.revertAppliedCommands();
        expect((await CommandFileStore.getCommandFileByName("Example"))?.content).toBe(baseline);
        expect(await tracker.execute()).toEqual(result);
        expect((await CommandFileStore.getCommandFileByName("Example"))?.content).toBe(second);
    }, 360_000);
});

const graphAvailable = globalThis.isLogseqAvailable && globalThis.isLogseqCurrentIsDBGraph;
describe.skipIf(!graphAvailable)("BashCommand real graph transactions", () => {
    const cleanup = async () => {
        for (const name of [REPLAY_PAGE, FAILURE_PAGE]) await deletePagePermanently(name);
    };
    beforeAll(cleanup, 120_000);
    afterAll(cleanup, 120_000);

    test(
        "serializes, reverts and replays recorded graph commands without rerunning Python",
        async ({sandbox}) => {
            await CommandFileStore.saveCommandFile(commandMarkdown("ReplaySeed", "sentinel A"));
            const {bash, tracker} = sandbox.createCommand(
                pythonCommand(`
import json, logseq_lib
seed = await logseq_lib.read_command_file({'commandName': 'ReplaySeed'})
assert 'sentinel A' in seed['content']
page = await logseq_lib.create_page({'pageName': '${REPLAY_PAGE}'})
block = await logseq_lib.insert_block({'parentUuid': page['uuid'], 'content': 'recorded café', 'sibling': False})
print(json.dumps({'page': page['uuid'], 'block': block['uuid']}))
`)
            );
            const result = await tracker.execute();
            expect(result).toMatchObject({stderr: "", exitCode: 0});
            expect(result.stdout.startsWith(PYTHON_PACKAGE_OUTPUT)).toBe(true);
            const identities = JSON.parse(result.stdout.slice(PYTHON_PACKAGE_OUTPUT.length)) as {
                page: string;
                block: string;
            };
            expect(bash.getCommands().map((command) => command.constructor.name)).toEqual([
                "ReadCommandFileCommand",
                "CreatePageCommand",
                "InsertBlockCommand"
            ]);
            expect(tracker.getAppliedCommandCount()).toBe(1);
            expect(tracker.hasAppliedGraphMutations()).toBe(true);
            expect(tracker.getChangedPages()).toContain(identities.page);
            expect((await logseq.Editor.getBlock(identities.block))?.content).toBe("recorded café");
            const restored = Serializer.deserialize(
                JSON.parse(JSON.stringify(Serializer.serialize(tracker)))
            );
            sandbox.replaceTracker(tracker, restored);
            await restored.revertAppliedCommands();
            expect(restored.getAppliedCommandCount()).toBe(0);
            expect(restored.getCommands()).toHaveLength(1);
            expect(isPageSoftDeleted((await logseq.Editor.getPage(identities.page))!)).toBe(true);
            expect(await logseq.Editor.getBlock(identities.block)).toBeNull();
            await CommandFileStore.saveCommandFile(commandMarkdown("ReplaySeed", "sentinel B"));
            expect(await restored.execute()).toEqual(result);
            expect(restored.getAppliedCommandCount()).toBe(1);
            expect((await logseq.Editor.getPage(REPLAY_PAGE))?.uuid).toBe(identities.page);
            expect((await logseq.Editor.getBlock(identities.block))?.content).toBe("recorded café");
            expect((await CommandFileStore.getCommandFileByName("ReplaySeed"))?.content).toContain(
                "sentinel B"
            );
            expect(restored.getCommands()[0]).toBeInstanceOf(BashCommand);
        },
        WORKER_TIMEOUT
    );

    test(
        "drops a failed queued host command and continues with undoable successes",
        async ({sandbox}) => {
            const {bash, tracker} = sandbox.createCommand(
                pythonCommand(`
import logseq_lib
page = await logseq_lib.create_page({'pageName': '${FAILURE_PAGE}'})
try:
    await logseq_lib.create_page({'pageName': '${FAILURE_PAGE}'})
except Exception:
    pass
else:
    raise AssertionError('duplicate create unexpectedly succeeded')
await logseq_lib.insert_block({'parentUuid': page['uuid'], 'content': 'after caught failure', 'sibling': False})
print('continued')
`)
            );
            expect(await tracker.execute()).toEqual({
                stdout: `${PYTHON_PACKAGE_OUTPUT}continued\n`,
                stderr: "",
                exitCode: 0
            });
            expect(bash.getCommands().map((command) => command.constructor.name)).toEqual([
                "CreatePageCommand",
                "InsertBlockCommand"
            ]);
            const uuid = (await logseq.Editor.getPage(FAILURE_PAGE))!.uuid;
            await tracker.revertAppliedCommands();
            expect(isPageSoftDeleted((await logseq.Editor.getPage(uuid))!)).toBe(true);
        },
        WORKER_TIMEOUT
    );
});
