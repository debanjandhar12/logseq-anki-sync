import {afterEach, describe, expect, test, vi} from "vitest";
import {OpenAIChatCommand} from "../../../../src/core/chat-interop";
import {ChatInteropCommandQueue} from "../../../../src/core/chat-interop/queue/ChatInteropCommandQueue";
import * as commandTemplate from "../../../../src/core/command-parser";
import {CommandFileStore} from "../../../../src/core/stores/command-file-store/CommandFileStore";
import type {CommandFileData} from "../../../../src/core/stores/command-file-store/types";
import {getUserCommands} from "../../../../src/core/user-commands";

function commandFile(overrides: Partial<CommandFileData> = {}): CommandFileData {
    return {
        name: "Summarize",
        invokeConditions: ["Block Context Menu/Other Blocks"],
        userInvocable: true,
        commandInvokeInNewThread: true,
        content: `---\nname: Summarize\ninvoke-condition:\n  - Block Context Menu/Other Blocks\n---\nSummarize this`,
        ...overrides
    };
}

const context = {
    source: "block-context-menu" as const,
    condition: "Block Context Menu/Other Blocks" as const,
    uuid: "block-uuid"
};

describe("getUserCommands", () => {
    afterEach(() => vi.restoreAllMocks());

    test("filters disabled and ineligible files and pins Add as attachment first", async () => {
        vi.spyOn(CommandFileStore, "getAllCommandFiles").mockResolvedValue([
            commandFile({name: "Zebra"}),
            commandFile({
                name: "Add as attachment",
                commandInvokeInNewThread: false,
                builtInCommand: true
            }),
            commandFile({name: "Disabled", userInvocable: false}),
            commandFile({name: "Slash", invokeConditions: ["Block Slash Command"]})
        ]);

        const commands = await getUserCommands(context);

        expect(commands.map(({name}) => name)).toEqual(["Add as attachment", "Zebra"]);
        expect(commands[0].builtInCommand).toBe(true);
    });

    test("renders first and enqueues the invocation steps before opening chat", async () => {
        vi.spyOn(CommandFileStore, "getAllCommandFiles").mockResolvedValue([commandFile()]);
        vi.spyOn(commandTemplate, "renderCommandFileTemplate").mockResolvedValue(
            "  Summarize this\n"
        );
        const enqueue = vi.spyOn(ChatInteropCommandQueue, "enqueue").mockImplementation(() => {});
        const open = vi.spyOn(OpenAIChatCommand.prototype, "execute").mockResolvedValue();

        const [command] = await getUserCommands(context);
        await command.execute();

        expect(enqueue.mock.calls.map(([runtimeCommand]) => runtimeCommand)).toEqual([
            {type: "new-thread"},
            {type: "clear-composer"},
            {type: "add-attachment", payload: {uuid: "block-uuid"}},
            {type: "set-composer-text", payload: {text: "Summarize this"}}
        ]);
        expect(open).toHaveBeenCalledOnce();
        expect(enqueue.mock.invocationCallOrder.at(-1)).toBeLessThan(
            open.mock.invocationCallOrder[0]
        );
    });

    test("does not enqueue anything when template rendering fails", async () => {
        vi.spyOn(CommandFileStore, "getAllCommandFiles").mockResolvedValue([
            commandFile({content: "---\nname: Summarize\n---\n<% unknownVariable %>"})
        ]);
        vi.spyOn(commandTemplate, "renderCommandFileTemplate").mockRejectedValue(
            new Error("Template failed")
        );
        const enqueue = vi.spyOn(ChatInteropCommandQueue, "enqueue").mockImplementation(() => {});
        const open = vi.spyOn(OpenAIChatCommand.prototype, "execute").mockResolvedValue();

        const [command] = await getUserCommands(context);
        await expect(command.execute()).rejects.toThrow();
        expect(enqueue).not.toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled();
    });
});
