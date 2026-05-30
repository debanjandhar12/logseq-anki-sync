import type {ToolResponse} from "assistant-stream";
import {BaseChatTool} from "src/chat-app/tools";
import {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";

export abstract class BaseChatToolWithDefaultUI<
    TArgs extends Record<string, unknown> = Record<string, unknown>,
    TResult = any
> extends BaseChatTool<TArgs, TResult> {
    abstract execute(
        args: TArgs,
        context?: ChatToolExecutionContext
    ): Promise<TResult | ToolResponse<TResult>>;
}