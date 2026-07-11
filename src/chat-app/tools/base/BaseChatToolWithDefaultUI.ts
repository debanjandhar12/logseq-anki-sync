import {BaseChatTool, type ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import type {ChatToolResponse, ChatToolResult} from "src/chat-app/tools/base/ChatToolResponse";

export abstract class BaseChatToolWithDefaultUI<
    TArgs extends Record<string, unknown> = Record<string, unknown>,
    TResult extends ChatToolResult = ChatToolResult
> extends BaseChatTool<TArgs, TResult> {
    abstract execute(
        args: TArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<TResult>>;
}
