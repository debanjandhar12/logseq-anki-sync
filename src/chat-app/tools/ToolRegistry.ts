import type {ToolCallMessagePartComponent} from "@assistant-ui/react";
import type {Tool} from "assistant-stream";
import {
    READ_LOGSEQ_BLOCK_TOOL_NAME,
    readLogseqBlockTool,
    UPSERT_LOGSEQ_BLOCK_TOOL_NAME,
    UpsertLogseqBlockToolUI,
    upsertLogseqBlockTool
} from "./logseqBlockTools";

type RegisteredTool = Tool<any, any> & {
    render?: ToolCallMessagePartComponent;
};

export class ChatToolRegistry {
    private static instance: ChatToolRegistry | undefined;

    private readonly tools = new Map<string, Tool>();
    private readonly toolUIs = new Map<string, ToolCallMessagePartComponent>();

    static getInstance(): ChatToolRegistry {
        if (!ChatToolRegistry.instance) {
            ChatToolRegistry.instance = ChatToolRegistry.createDefault();
        }

        return ChatToolRegistry.instance;
    }

    getTools(): Record<string, Tool> {
        return Object.fromEntries(this.tools);
    }

    getToolUIs(): ReadonlyMap<string, ToolCallMessagePartComponent> {
        return this.toolUIs;
    }

    private static createDefault(): ChatToolRegistry {
        const registry = new ChatToolRegistry();

        registry.registerTool(READ_LOGSEQ_BLOCK_TOOL_NAME, readLogseqBlockTool);
        registry.registerTool(UPSERT_LOGSEQ_BLOCK_TOOL_NAME, {
            ...upsertLogseqBlockTool,
            render: UpsertLogseqBlockToolUI
        });

        return registry;
    }

    private registerTool(toolName: string, tool: RegisteredTool): void {
        const {render, ...toolDefinition} = tool;
        this.tools.set(toolName, toolDefinition);
        if (render) {
            this.toolUIs.set(toolName, render);
        }
    }
}
