import {beforeAll, beforeEach, describe, expect, test} from "vitest";
import {JustBashAdapterFS, JustBashWrapper} from "../../../../src/core/just-bash-wrapper";
import {ToolResultStore} from "../../../../src/core/stores/tool-results/ToolResultStore";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

async function expectCommandToFail(command: string): Promise<void> {
    try {
        expect((await JustBashWrapper.getInstance().exec(command)).exitCode).not.toBe(0);
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
    });

    test("returns the same Bash instance", () => {
        expect(JustBashWrapper.getInstance()).toBe(JustBashWrapper.getInstance());
    });

    test("executes commands and persists files between calls", async () => {
        const bash = JustBashWrapper.getInstance();

        expect((await bash.exec("echo hello > /home/user/scratch/note.txt")).exitCode).toBe(0);
        expect((await bash.exec("cat /home/user/scratch/note.txt")).stdout).toBe("hello\n");
        expect((await bash.exec("wc -l /home/user/scratch/note.txt")).stdout).toBe(
            "1 /home/user/scratch/note.txt\n"
        );
    });

    test("denies writes outside explicit read-write mounts", async () => {
        const bash = JustBashWrapper.getInstance();

        await expectCommandToFail("echo denied > /home/user/nope.txt");
        await expectCommandToFail("touch /tmp/nope.txt");
        await expectCommandToFail("mkdir /workspace");
        await expect(bash.fs.exists("/home/user/nope.txt")).resolves.toBe(false);
        await expect(bash.fs.exists("/tmp/nope.txt")).resolves.toBe(false);
        await expect(bash.fs.exists("/workspace")).resolves.toBe(false);
    });

    test("denies cross-mount writes into the read-only base", async () => {
        const bash = JustBashWrapper.getInstance();

        expect((await bash.exec("echo allowed > /home/user/scratch/source.txt")).exitCode).toBe(0);
        await expectCommandToFail("cp /home/user/scratch/source.txt /home/user/copied.txt");
        expect((await bash.exec("cat /home/user/scratch/source.txt")).stdout).toBe("allowed\n");
        await expect(bash.fs.exists("/home/user/copied.txt")).resolves.toBe(false);
    });

    test("mounts tool results read-only", async () => {
        const bash = JustBashWrapper.getInstance();

        expect((await bash.exec("ls /home/user/tool-results")).stdout).toContain(
            "call-1_web_search.json"
        );
        expect((await bash.exec("cat /home/user/tool-results/call-1_web_search.json")).stdout).toBe(
            '{"ok":true}'
        );
        expect((await bash.exec("touch /home/user/tool-results/nope.txt")).exitCode).not.toBe(0);
        await expectCommandToFail("touch /home/user/tool-results/call-1_web_search.json");
    });

    test("uses /home/user and disables Python and JavaScript execution", async () => {
        const bash = JustBashWrapper.getInstance();

        expect((await bash.exec("pwd")).stdout).toBe("/home/user\n");
        expect((await bash.exec("python3 --version")).exitCode).not.toBe(0);
        expect((await bash.exec("js-exec '1 + 1'")).exitCode).not.toBe(0);
    });
});
