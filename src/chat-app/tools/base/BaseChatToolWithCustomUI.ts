import type {ToolCallMessagePartComponent} from "@assistant-ui/react";
import {BaseChatTool} from "src/chat-app/tools/base/BaseChatTool";
import type {ChatToolResult} from "src/chat-app/tools/base/ChatToolResponse";

export abstract class BaseChatToolWithCustomUI<
    TArgs extends Record<string, unknown> = Record<string, unknown>,
    TResult extends ChatToolResult = ChatToolResult
> extends BaseChatTool<TArgs, TResult> {
    abstract readonly render: ToolCallMessagePartComponent<TArgs, TResult>;
}
