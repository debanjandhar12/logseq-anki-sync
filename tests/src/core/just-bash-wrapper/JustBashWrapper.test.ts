import {beforeAll, beforeEach, describe, expect, test} from "vitest";
import {JustBashAdapterFS, JustBashWrapper} from "../../../../src/core/just-bash-wrapper";
import {ToolResultStore} from "../../../../src/core/stores/tool-results/ToolResultStore";
import {LogseqPluginStorageManager} from "../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

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

    test("mounts tool results read-only", async () => {
        const bash = JustBashWrapper.getInstance();

        expect((await bash.exec("ls /home/user/tool-results")).stdout).toContain(
            "call-1_web_search.json"
        );
        expect((await bash.exec("cat /home/user/tool-results/call-1_web_search.json")).stdout).toBe(
            '{"ok":true}'
        );
        expect((await bash.exec("touch /home/user/tool-results/nope.txt")).exitCode).not.toBe(0);
    });

    test("uses /home/user and disables Python and JavaScript execution", async () => {
        const bash = JustBashWrapper.getInstance();

        expect((await bash.exec("pwd")).stdout).toBe("/home/user\n");
        expect((await bash.exec("python3 --version")).exitCode).not.toBe(0);
        expect((await bash.exec("js-exec '1 + 1'")).exitCode).not.toBe(0);
    });
});
