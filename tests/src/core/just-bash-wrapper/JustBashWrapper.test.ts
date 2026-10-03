import {beforeAll, beforeEach, describe, expect, test, vi} from "vitest";
import {JustBashAdapterFS, JustBashWrapper} from "../../../../src/core/just-bash-wrapper";
import {AnyDocParseResultStore} from "../../../../src/core/stores/anydoc-parse-result-store/AnyDocParseResultStore";
import {ToolResultStore} from "../../../../src/core/stores/tool-results/ToolResultStore";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

async function expectCommandToFail(command: string): Promise<void> {
    try {
        expect((await (await JustBashWrapper.getInstance()).exec(command)).exitCode).not.toBe(0);
    } catch (error) {
        expect(error).toBeInstanceOf(Error);
    }
}

describe("JustBashWrapper", () => {
    beforeAll(() => {
        LogseqPluginStorageManager.store = new InMemoryStore("just-bash-wrapper-test");
        JustBashAdapterFS.addLogseqPluginFolder("scratch", "readwrite");
    });

    beforeEach(async () => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("just-bash-wrapper-test");
        JustBashWrapper.resetInstanceForTesting();
        await LogseqPluginStorageManager.saveFile(
            ToolResultStore.groupName,
            "call-1_web_search.json",
            '{"ok":true}'
        );
        await LogseqPluginStorageManager.saveFile(
            AnyDocParseResultStore.groupName,
            `${"a".repeat(64)}-page-1.md`,
            "parsed page"
        );
    });

    test("returns the same Bash instance", async () => {
        expect(await JustBashWrapper.getInstance()).toBe(await JustBashWrapper.getInstance());
    });

    test("executes commands and persists files between calls", async () => {
        const bash = await JustBashWrapper.getInstance();

        expect((await bash.exec("echo hello > /home/user/scratch/note.txt")).exitCode).toBe(0);
        expect((await bash.exec("cat /home/user/scratch/note.txt")).stdout).toBe("hello\n");
        expect((await bash.exec("wc -l /home/user/scratch/note.txt")).stdout).toBe(
            "1 /home/user/scratch/note.txt\n"
        );
    });

    test("denies writes outside explicit read-write mounts", async () => {
        const bash = await JustBashWrapper.getInstance();

        await expectCommandToFail("echo denied > /home/user/nope.txt");
        await expectCommandToFail("touch /tmp/nope.txt");
        await expectCommandToFail("mkdir /workspace");
        await expect(bash.fs.exists("/home/user/nope.txt")).resolves.toBe(false);
        await expect(bash.fs.exists("/tmp/nope.txt")).resolves.toBe(false);
        await expect(bash.fs.exists("/workspace")).resolves.toBe(false);
    });

    test("denies cross-mount writes into the read-only base", async () => {
        const bash = await JustBashWrapper.getInstance();

        expect((await bash.exec("echo allowed > /home/user/scratch/source.txt")).exitCode).toBe(0);
        await expectCommandToFail("cp /home/user/scratch/source.txt /home/user/copied.txt");
        expect((await bash.exec("cat /home/user/scratch/source.txt")).stdout).toBe("allowed\n");
        await expect(bash.fs.exists("/home/user/copied.txt")).resolves.toBe(false);
    });

    test("mounts tool results read-only", async () => {
        const bash = await JustBashWrapper.getInstance();

        expect((await bash.exec("ls /home/user/tool-results")).stdout).toContain(
            "call-1_web_search.json"
        );
        expect((await bash.exec("cat /home/user/tool-results/call-1_web_search.json")).stdout).toBe(
            '{"ok":true}'
        );
        expect((await bash.exec("touch /home/user/tool-results/nope.txt")).exitCode).not.toBe(0);
        await expectCommandToFail("touch /home/user/tool-results/call-1_web_search.json");
    });

    test("mounts AnyDoc results read-only", async () => {
        const bash = await JustBashWrapper.getInstance();
        const fileName = `${"a".repeat(64)}-page-1.md`;

        expect((await bash.exec(`cat /home/user/anydoc-parse-results/${fileName}`)).stdout).toBe(
            "parsed page"
        );
        await expectCommandToFail(`touch /home/user/anydoc-parse-results/${fileName}`);
        await expectCommandToFail(`rm /home/user/anydoc-parse-results/${fileName}`);
    });

    test("uses /home/user and registers Pyodide command aliases", async () => {
        const bash = await JustBashWrapper.getInstance();

        expect((await bash.exec("pwd")).stdout).toBe("/home/user\n");
        expect((await bash.exec("python --help")).stdout).toContain("Usage: python");
        expect((await bash.exec("python3 --help")).stdout).toContain("Usage: python3");
        expect((await bash.exec("py --help")).stdout).toContain("Usage: py");
        expect((await bash.exec("js-exec '1 + 1'")).exitCode).not.toBe(0);
        expect((await bash.exec("qjs --help")).exitCode).not.toBe(0);
    });

    test("initializes nested glob state and refreshes external additions/deletions", async () => {
        await LogseqPluginStorageManager.saveFile("skills/alpha", "SKILL.md", "alpha");
        await LogseqPluginStorageManager.saveFile(
            "skills/alpha",
            "references/nested/info.md",
            "reference"
        );
        const bash = await JustBashWrapper.getInstance();
        const initial = await bash.exec("cat /home/user/skills/*/SKILL.md");
        expect(initial.exitCode).toBe(0);
        expect(initial.stdout).toBe("alpha");
        const found = await bash.exec("find /home/user/skills -type f");
        expect(found.stdout).toContain("/home/user/skills/alpha/references/nested/info.md");
        expect(
            (await bash.exec("cat /home/user/skills/alpha/references/nested/info.md")).stdout
        ).toBe("reference");
        await LogseqPluginStorageManager.saveFile("skills/beta", "SKILL.md", "beta");
        await LogseqPluginStorageManager.deleteFile("skills/alpha", "SKILL.md");
        const refreshed = await JustBashWrapper.getInstance();
        expect(refreshed).toBe(bash);
        expect((await refreshed.exec("cat /home/user/skills/*/SKILL.md")).stdout).toBe("beta");
        await expectCommandToFail("echo overwrite > /home/user/skills/beta/SKILL.md");
        await expectCommandToFail("rm -r /home/user/skills/beta");
    });

    test("executes recursive filesystem operations in a writable mount", async () => {
        const bash = await JustBashWrapper.getInstance();
        for (const command of [
            "mkdir -p /home/user/scratch/source/nested",
            "echo text > /home/user/scratch/source/nested/file",
            "cp -r /home/user/scratch/source /home/user/scratch/copy",
            "mv /home/user/scratch/copy /home/user/scratch/moved"
        ])
            expect((await bash.exec(command)).exitCode).toBe(0);
        expect((await bash.exec("cat /home/user/scratch/moved/nested/file")).stdout).toBe("text\n");
        expect((await bash.exec("rm -r /home/user/scratch/moved")).exitCode).toBe(0);
        expect(await bash.fs.exists("/home/user/scratch/moved")).toBe(false);
    });

    test("retries failed mount initialization", async () => {
        const failure = new Error("storage unavailable");
        const read = vi.spyOn(LogseqPluginStorageManager, "getFiles").mockRejectedValue(failure);
        await expect(JustBashWrapper.getInstance()).rejects.toBe(failure);
        read.mockRestore();
        expect((await (await JustBashWrapper.getInstance()).exec("pwd")).stdout).toBe(
            "/home/user\n"
        );
    });
});
