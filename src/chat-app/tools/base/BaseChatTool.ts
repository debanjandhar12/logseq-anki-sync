import type {ThreadMessage, ToolCallMessagePartComponent} from "@assistant-ui/react";
import type {Tool} from "assistant-stream";
import type {ChatToolResponse, ChatToolResult} from "src/chat-app/tools/base/ChatToolResponse";
import type {z} from "zod";

export type ChatToolExecutionContext = {
    toolCallId?: string;
    abortSignal?: AbortSignal;
    human?: (payload: unknown) => Promise<unknown>;
    messages?: readonly ThreadMessage[];
};

export abstract class BaseChatTool<
    TArgs extends Record<string, unknown> = Record<string, unknown>,
    TResult extends ChatToolResult = ChatToolResult
> {
    /** The unique identifier for the tool */
    abstract readonly name: string;

    /** The description provided to the LLM */
    abstract readonly description: string;

    /** The Zod schema defining the tool's parameters */
    abstract readonly parameters: z.ZodType<TArgs>;

    /** Tool type: 'frontend' for standard execution, 'human' for user interaction */
    readonly type: "frontend" | "human" = "frontend";

    /**
     * Optional UI component to render the tool call in the chat.
     */
    readonly render?: ToolCallMessagePartComponent<TArgs, TResult>;

    /**
     * The actual execution logic for the tool.
     * Human tools with custom UI can omit this because their UI supplies the result.
     */
    execute?(args: TArgs, context?: ChatToolExecutionContext): Promise<ChatToolResponse<TResult>>;

    /**
     * Retrieves the tool definition compatible with `assistant-stream`.
     */
    getDefinition(): Tool<TArgs, TResult> {
        const definition = {
            type: this.type,
            description: this.description,
            parameters: this.parameters
        };

        if (!this.execute) return definition as Tool<TArgs, TResult>;

        return {
            ...definition,
            execute: this.execute.bind(this)
        } as Tool<TArgs, TResult>;
    }
}
