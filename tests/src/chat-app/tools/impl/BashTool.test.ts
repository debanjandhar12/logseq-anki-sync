import {beforeAll, beforeEach, describe, expect, test} from "vitest";
import {BashTool} from "../../../../../src/chat-app/tools/impl/BashTool";
import {JustBashWrapper} from "../../../../../src/core/just-bash-wrapper";
import {ToolResultStore} from "../../../../../src/core/stores/tool-results/ToolResultStore";
import {LogseqPluginStorageManager} from "../../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

describe("BashTool", () => {
    beforeAll(() => {
        LogseqPluginStorageManager.store = new InMemoryStore("bash-tool-test");
    });

    beforeEach(async () => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("bash-tool-test");
        JustBashWrapper.resetInstanceForTesting();
        await LogseqPluginStorageManager.saveFile(
            ToolResultStore.groupName,
            "call-1_web_search.json",
            '{"ok":true}'
        );
    });

    test("returns command output inline", async () => {
        const response = await new BashTool().execute({command: "echo hi"});

        expect(response.result).toEqual({
            success: true,
            stdout: "hi\n",
            stderr: "",
            exitCode: 0
        });
    });

    test("respects the working directory parameter", async () => {
        const response = await new BashTool().execute({
            command: "pwd",
            cwd: "/home/user/tool-results"
        });

        expect(response.result).toMatchObject({
            success: true,
            stdout: "/home/user/tool-results\n",
            exitCode: 0
        });
    });

    test("reports non-zero exit codes as command data", async () => {
        const response = await new BashTool().execute({command: "exit 3"});

        expect(response.result).toMatchObject({success: true, exitCode: 3});
    });
});
