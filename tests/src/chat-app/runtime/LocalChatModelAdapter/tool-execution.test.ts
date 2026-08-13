import type {Tool} from "assistant-stream";
import {ToolResponse} from "assistant-stream";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {createToolCallMessagePart} from "../../../../../src/chat-app/runtime/LocalChatModelAdapter/tool-call-message-part";
import {
    createFrontendToolErrorPatch,
    invokeFrontendTool,
    normalizeFrontendToolOutput
} from "../../../../../src/chat-app/runtime/LocalChatModelAdapter/tool-execution";
import {CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR} from "../../../../../src/constants";
import {ToolResultStore} from "../../../../../src/core/stores/tool-results/ToolResultStore";
import {LogseqPluginStorageManager} from "../../../../../src/logseq/LogseqPluginStorageManager";
import {InMemoryStore} from "../../../../../src/logseq/LogseqPluginStorageManager/InMemoryStore";

const TOOL_CALL_ID = "call-1";
const TOOL_NAME = "test_tool";
const EXPECTED_FILE_NAME = `${TOOL_CALL_ID}_${TOOL_NAME}.json`;

function createTool(execute: Tool["execute"], toModelOutput?: Tool["toModelOutput"]): Tool {
    return {
        type: "frontend",
        execute,
        ...(toModelOutput ? {toModelOutput} : {})
    } as Tool;
}

async function executeTool(tool: Tool) {
    const toolCall = createToolCallMessagePart({
        type: "tool-call",
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        input: {}
    });
    try {
        const output = await invokeFrontendTool(tool, toolCall, new AbortController().signal, []);
        return await normalizeFrontendToolOutput(tool, toolCall, output);
    } catch (error) {
        return createFrontendToolErrorPatch(error);
    }
}

describe("executeFrontendTool tool result size limit", () => {
    beforeEach(() => {
        InMemoryStore.clearAll();
        LogseqPluginStorageManager.store = new InMemoryStore("tool-result-size-limit-test");
        vi.restoreAllMocks();
    });

    test("returns a below-limit result unchanged without storing it", async () => {
        const result = "small result";
        const toModelOutput = vi.fn(async () => [{type: "text" as const, text: "model result"}]);

        await expect(executeTool(createTool(async () => result, toModelOutput))).resolves.toEqual({
            result,
            artifact: undefined,
            isError: false,
            modelContent: [{type: "text", text: "model result"}]
        });
        expect(toModelOutput).toHaveBeenCalledOnce();
        await expect(
            LogseqPluginStorageManager.getFiles(ToolResultStore.groupName)
        ).resolves.toEqual([]);
    });

    test("passes branch messages and execution identifiers to the project tool", async () => {
        const messages = [{id: "branch-message"}] as never;
        const execute = vi.fn(async () => ({success: true}));
        const toolCall = createToolCallMessagePart({
            type: "tool-call",
            toolCallId: TOOL_CALL_ID,
            toolName: TOOL_NAME,
            input: {value: 1}
        });
        const abortSignal = new AbortController().signal;

        await invokeFrontendTool(createTool(execute), toolCall, abortSignal, messages);

        expect(execute).toHaveBeenCalledWith(
            {value: 1},
            expect.objectContaining({toolCallId: TOOL_CALL_ID, abortSignal, messages})
        );
    });

    test("does not store or truncate a result exactly at the limit", async () => {
        const result = "x".repeat(CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR - 2);
        expect(JSON.stringify(result, null, 2)).toHaveLength(CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR);

        await expect(executeTool(createTool(async () => result))).resolves.toMatchObject({result});
        await expect(
            LogseqPluginStorageManager.getFiles(ToolResultStore.groupName)
        ).resolves.toEqual([]);
    });

    test("stores the full oversized result and returns its truncated head and path", async () => {
        const result = {
            content: "x".repeat(CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR),
            nested: {complete: true}
        };
        const serializedResult = JSON.stringify(result, null, 2);
        const removedCharacterCount = serializedResult.length - CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR;
        const response = await executeTool(createTool(async () => result));

        expect(response.result).toBe(
            `${serializedResult.slice(0, CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR)}\n` +
                `...${removedCharacterCount} characters truncated...\n\n` +
                "The tool call succeeded but the output was truncated. Full output saved to: " +
                `/home/user/tool-results/${EXPECTED_FILE_NAME}\n` +
                "Use Bash tool to search and read with offset/limit to view specific sections."
        );
        expect(response).toMatchObject({isError: false});
        expect(response.modelContent).toBeUndefined();
        await expect(
            LogseqPluginStorageManager.getFileContent(
                ToolResultStore.groupName,
                EXPECTED_FILE_NAME
            ).then((content) => JSON.parse(content!))
        ).resolves.toEqual(result);
    });

    test("discards oversized explicit model content and skips toModelOutput", async () => {
        const result = "x".repeat(CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR);
        const toModelOutput = vi.fn(async () => [{type: "text" as const, text: result}]);
        const tool = createTool(
            async () =>
                new ToolResponse({
                    result,
                    modelContent: [{type: "text", text: result}]
                }),
            toModelOutput
        );

        const response = await executeTool(tool);

        expect(response.modelContent).toBeUndefined();
        expect(toModelOutput).not.toHaveBeenCalled();
    });

    test("does not store or truncate oversized error results", async () => {
        const result = "x".repeat(CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR);
        const response = await executeTool(
            createTool(async () => new ToolResponse({result, isError: true}))
        );

        expect(response).toMatchObject({result, isError: true});
        await expect(
            LogseqPluginStorageManager.getFiles(ToolResultStore.groupName)
        ).resolves.toEqual([]);
    });

    test("returns a tool error when storing an oversized result fails", async () => {
        vi.spyOn(LogseqPluginStorageManager, "saveFile").mockRejectedValueOnce(
            new Error("storage failed")
        );
        const result = "x".repeat(CHAT_APP_AGENT_TOOL_RESULT_MAX_CHAR);

        await expect(executeTool(createTool(async () => result))).resolves.toEqual({
            result: {success: false, error: "storage failed"},
            isError: true
        });
    });

    test("settles promptly when a frontend tool ignores cancellation", async () => {
        const abortController = new AbortController();
        const neverSettles = new Promise<unknown>(() => {});
        const execution = invokeFrontendTool(
            createTool(() => neverSettles),
            createToolCallMessagePart({
                type: "tool-call",
                toolCallId: TOOL_CALL_ID,
                toolName: TOOL_NAME,
                input: {}
            }),
            abortController.signal,
            []
        );

        abortController.abort();

        await expect(execution).rejects.toMatchObject({name: "AbortError"});
    });
});
