import type {ToolCallMessagePartComponent} from "@assistant-ui/react";
import {BaseChatTool} from "src/chat-app/tools";

export abstract class BaseChatToolWithCustomUI<
    TArgs extends Record<string, unknown> = Record<string, unknown>,
    TResult = any
> extends BaseChatTool<TArgs, TResult> {
    abstract readonly render: ToolCallMessagePartComponent<TArgs, TResult>;
}