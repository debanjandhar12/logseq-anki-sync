import CREATE_PAGE from "src/chat-app/prompts/skills/working-with-bash-and-pyodide/internal/CREATE_PAGE.py?raw";
import CREATE_SKILL from "src/chat-app/prompts/skills/working-with-bash-and-pyodide/internal/CREATE_SKILL.py?raw";
import GRAYSCALE_ASSET from "src/chat-app/prompts/skills/working-with-bash-and-pyodide/internal/GRAYSCALE_ASSET.py?raw";
import LIST_LOGSEQ_METHODS from "src/chat-app/prompts/skills/working-with-bash-and-pyodide/internal/LIST_LOGSEQ_METHODS.py?raw";
import SYMPY_INTEGRATION from "src/chat-app/prompts/skills/working-with-bash-and-pyodide/internal/SYMPY_INTEGRATION.py?raw";
import YOUTUBE_TRANSCRIPT from "src/chat-app/prompts/skills/working-with-bash-and-pyodide/internal/YOUTUBE_TRANSCRIPT.py?raw";
import {AssetFileOperations} from "src/core/logseq-reversible-transaction-tracker/commands/utils/AssetFileOperations";
import {isPageSoftDeleted} from "src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";
import {SkillStore} from "src/core/stores/skill-store/SkillStore";
import {afterAll, beforeAll, describe, expect} from "vitest";
import {deletePagePermanently} from "../../../helpers/logseq/deletePagePermanently";
import {test} from "../../core/logseq-reversible-transaction-tracker/commands/fixtures/bashCommandFixture";

const WORKER_TIMEOUT = 180_000;
const PAGE_NAME = "test-skill-pyodide-create-page";
const SKILL_NAME = "test-skill-pyodide-create-skill";
const pythonCommand = (source: string, argument?: string) =>
    `python -${argument ? ` '${argument}'` : ""} <<'PY'\n${source}\nPY`;
const lastOutputLine = (stdout: string) => stdout.trim().split("\n").at(-1)!;

describe("Python examples embedded in the Bash and Pyodide skill", () => {
    test(
        "integrates x squared and prints LaTeX with real SymPy",
        async ({sandbox}) => {
            const result = await sandbox
                .createCommand(pythonCommand(SYMPY_INTEGRATION))
                .tracker.execute();
            expect(result.exitCode, result.stderr).toBe(0);
            expect(result.stderr).toBe("");
            expect(result.stdout.trim().split("\n").slice(-2)).toEqual([
                "x**3/3",
                "\\frac{x^{3}}{3}"
            ]);
        },
        WORKER_TIMEOUT
    );

    test(
        "fetches the documented YouTube video's English transcript",
        async ({sandbox}) => {
            const result = await sandbox
                .createCommand(pythonCommand(YOUTUBE_TRANSCRIPT))
                .tracker.execute();
            expect(result.exitCode, result.stderr).toBe(0);
            expect(result.stderr).toBe("");
            const segments = JSON.parse(lastOutputLine(result.stdout));
            expect(segments.length).toBeGreaterThan(0);
            for (const segment of segments) {
                expect(segment).toEqual({
                    text: expect.any(String),
                    start: expect.any(Number),
                    duration: expect.any(Number)
                });
            }
            expect(segments.some((segment: {text: string}) => segment.text.trim())).toBe(true);
        },
        WORKER_TIMEOUT
    );

    test(
        "lists public Logseq methods without dispatching host commands",
        async ({sandbox}) => {
            const {bash, tracker} = sandbox.createCommand(pythonCommand(LIST_LOGSEQ_METHODS));
            const result = await tracker.execute();
            expect(result.exitCode, result.stderr).toBe(0);
            expect(result.stderr).toBe("");
            expect(JSON.parse(lastOutputLine(result.stdout))).toEqual([
                "create_page",
                "delete_block",
                "delete_command_file",
                "delete_page",
                "delete_skill",
                "insert_block",
                "read_asset",
                "read_command_file",
                "read_raw_skill",
                "save_asset",
                "save_command_file",
                "save_skill"
            ]);
            expect(bash.getCommands()).toEqual([]);
            expect(tracker.hasAppliedGraphMutations()).toBe(false);
        },
        WORKER_TIMEOUT
    );

    test(
        "creates a valid skill through Logseq Lib and undoes its creation",
        async ({sandbox}) => {
            const {bash, tracker} = sandbox.createCommand(pythonCommand(CREATE_SKILL, SKILL_NAME));
            const result = await tracker.execute();
            expect(result.exitCode, result.stderr).toBe(0);
            expect(result.stderr).toBe("");
            const saved = JSON.parse(lastOutputLine(result.stdout));
            const skill = await SkillStore.getSkill(SKILL_NAME);
            expect(skill).not.toBeNull();
            expect(saved).toEqual({exists: true, content: skill!.content});
            expect(skill!.content).toContain(`name: ${SKILL_NAME}`);
            expect(bash.getCommands().map((command) => command.constructor.name)).toEqual([
                "PutSkillFileCommand",
                "ReadSkillFileCommand"
            ]);
            await tracker.revertAppliedCommands();
            expect(await SkillStore.getSkill(SKILL_NAME)).toBeNull();
        },
        WORKER_TIMEOUT
    );
});

// The browser test proxy does not expose Logseq's desktop asset filesystem APIs.
describe.skip("Python grayscale example against a real Logseq desktop graph", () => {
    const assetPath = "assets/test-skill-pyodide-grayscale.png";
    const missingAssetPath = "assets/test-skill-pyodide-grayscale-missing.png";

    beforeAll(async () => {
        const resolved = await AssetFileOperations.resolvePath(assetPath);
        if (!(await AssetFileOperations.readSnapshot(resolved)).exists) {
            const canvas = document.createElement("canvas");
            canvas.width = 2;
            canvas.height = 1;
            const context = canvas.getContext("2d")!;
            context.putImageData(
                new ImageData(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128]), 2, 1),
                0,
                0
            );
            await AssetFileOperations.write(resolved, canvas.toDataURL("image/png").split(",")[1]);
        }
    }, 120_000);

    afterAll(async () => {
        await AssetFileOperations.restoreSnapshot(
            await AssetFileOperations.resolvePath(assetPath),
            {exists: false}
        );
    }, 120_000);

    test(
        "overwrites a PNG with grayscale pixels, preserves alpha, and restores original bytes",
        async ({sandbox}) => {
            const resolved = await AssetFileOperations.resolvePath(assetPath);
            const original = await AssetFileOperations.readSnapshot(resolved);
            expect(original.exists).toBe(true);
            if (!original.exists) throw new Error("Missing grayscale test asset");
            const {bash, tracker} = sandbox.createCommand(
                pythonCommand(GRAYSCALE_ASSET, assetPath)
            );
            const result = await tracker.execute();
            expect(result.exitCode, result.stderr).toBe(0);
            expect(result.stderr).toBe("");
            expect(lastOutputLine(result.stdout)).toContain(
                `Verified existing image: ${assetPath}`
            );
            expect(bash.getCommands().map((command) => command.constructor.name)).toEqual([
                "ReadAssetFileCommand",
                "PutAssetFileCommand",
                "ReadAssetFileCommand"
            ]);

            const verification = await sandbox
                .createCommand(
                    pythonCommand(`
import base64, io, json, micropip
await micropip.install("Pillow==12.2.0")
from PIL import Image
import logseq_lib
original = Image.open(io.BytesIO(base64.b64decode(${JSON.stringify(original.contentBase64)})))
saved = await logseq_lib.read_asset({"assetPath": ${JSON.stringify(assetPath)}})
converted = Image.open(io.BytesIO(base64.b64decode(saved["contentBase64"])))
assert converted.size == original.size
assert converted.mode == "LA"
assert converted.getchannel("L").tobytes() == original.convert("L").tobytes()
assert converted.getchannel("A").tobytes() == original.convert("RGBA").getchannel("A").tobytes()
print("Verified grayscale pixels and alpha")
`)
                )
                .tracker.execute();
            expect(verification.exitCode, verification.stderr).toBe(0);
            expect(lastOutputLine(verification.stdout)).toBe("Verified grayscale pixels and alpha");
            await tracker.revertAppliedCommands();
            expect(await AssetFileOperations.readSnapshot(resolved)).toEqual(original);
        },
        WORKER_TIMEOUT * 2
    );

    test(
        "rejects a missing asset without writing a file",
        async ({sandbox}) => {
            const resolved = await AssetFileOperations.resolvePath(missingAssetPath);
            expect(await AssetFileOperations.readSnapshot(resolved)).toEqual({exists: false});
            const {bash, tracker} = sandbox.createCommand(
                pythonCommand(GRAYSCALE_ASSET, missingAssetPath)
            );
            const result = await tracker.execute();
            expect(result.exitCode).not.toBe(0);
            expect(result.stderr).toContain("FileNotFoundError");
            expect(
                bash
                    .getCommands()
                    .some((command) => command.constructor.name === "PutAssetFileCommand")
            ).toBe(false);
            expect(await AssetFileOperations.readSnapshot(resolved)).toEqual({exists: false});
        },
        WORKER_TIMEOUT
    );
});

const graphAvailable = globalThis.isLogseqAvailable && globalThis.isLogseqCurrentIsDBGraph;
describe.skipIf(!graphAvailable)("Python page example against a real Logseq DB graph", () => {
    const cleanup = async () => deletePagePermanently(PAGE_NAME);
    beforeAll(cleanup, 120_000);
    afterAll(cleanup, 120_000);

    test(
        "creates a page and child block and records reversible commands",
        async ({sandbox}) => {
            const {bash, tracker} = sandbox.createCommand(pythonCommand(CREATE_PAGE, PAGE_NAME));
            const result = await tracker.execute();
            expect(result.exitCode, result.stderr).toBe(0);
            expect(result.stderr).toBe("");
            const {pageUuid, blockUuid} = JSON.parse(lastOutputLine(result.stdout));
            expect((await logseq.Editor.getPage(PAGE_NAME))?.uuid).toBe(pageUuid);
            expect((await logseq.Editor.getBlock(blockUuid))?.content).toBe(
                "Created from Python with logseq_lib."
            );
            expect(
                (await logseq.Editor.getPageBlocksTree(pageUuid)).map((block) => block.uuid)
            ).toContain(blockUuid);
            expect(bash.getCommands().map((command) => command.constructor.name)).toEqual([
                "CreatePageCommand",
                "InsertBlockCommand"
            ]);
            await tracker.revertAppliedCommands();
            expect(isPageSoftDeleted((await logseq.Editor.getPage(pageUuid))!)).toBe(true);
            expect(await logseq.Editor.getBlock(blockUuid)).toBeNull();
        },
        WORKER_TIMEOUT
    );
});
