import type {ToolCallMessagePartComponent} from "@assistant-ui/react";
import type {Tool} from "assistant-stream";
import type {z} from "zod";

export abstract class BaseChatTool<
    TArgs extends Record<string, unknown> = Record<string, unknown>,
    TResult = any
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
     * Note: For "human" type tools, this might be a placeholder if execution is handled via UI.
     */
    abstract execute(args: TArgs): Promise<TResult>;

    /**
     * Retrieves the tool definition compatible with `assistant-stream`.
     */
    getDefinition(): Tool<TArgs, TResult> {
        return {
            type: this.type,
            description: this.description,
            parameters: this.parameters,
            execute: this.execute.bind(this)
        };
    }
}
