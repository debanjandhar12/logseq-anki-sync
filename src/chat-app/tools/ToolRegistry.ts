import type {ToolCallMessagePartComponent} from "@assistant-ui/react";
import type {Tool} from "assistant-stream";
import type {BaseChatTool} from "src/chat-app/tools/base/BaseChatTool";
import {LogseqClearChangesTool} from "src/chat-app/tools/impl/LogseqClearChangesTool";
import {LogseqCommitChangesTool} from "src/chat-app/tools/impl/LogseqCommitChangesTool";
import {LogseqCreatePageTool} from "src/chat-app/tools/impl/LogseqCreatePageTool";
import {LogseqDataScriptQueryTool} from "src/chat-app/tools/impl/LogseqDataScriptQueryTool";
import {LogseqDeletePageTool} from "src/chat-app/tools/impl/LogseqDeletePageTool";
import {GetUserInfoTool} from "src/chat-app/tools/impl/GetUserInfoTool";
import {LogseqInsertBlockTool} from "src/chat-app/tools/impl/LogseqInsertBlockTool";
import {LogseqMoveBlockTool} from "src/chat-app/tools/impl/LogseqMoveBlockTool";
import {LogseqReadBlockTool} from "src/chat-app/tools/impl/LogseqReadBlockTool";
import {SkillTool} from "src/chat-app/tools/impl/SkillTool";
import {LogseqRenamePageTool} from "src/chat-app/tools/impl/LogseqRenamePageTool";
import {LogseqTextSearchTool} from "src/chat-app/tools/impl/LogseqTextSearchTool";
import {LogseqUpdateBlockTool} from "src/chat-app/tools/impl/LogseqUpdateBlockTool";

export class ChatToolRegistry {
    private static instance: ChatToolRegistry | undefined;

    private readonly tools = new Map<string, Tool<any, any>>();
    private readonly toolUIs = new Map<string, ToolCallMessagePartComponent>();

    static getInstance(): ChatToolRegistry {
        if (!ChatToolRegistry.instance) {
            ChatToolRegistry.instance = ChatToolRegistry.createDefault();
        }

        return ChatToolRegistry.instance;
    }

    getTools(): Record<string, Tool<any, any>> {
        return Object.fromEntries(this.tools);
    }

    getToolUIs(): ReadonlyMap<string, ToolCallMessagePartComponent> {
        return this.toolUIs;
    }

    private static createDefault(): ChatToolRegistry {
        const registry = new ChatToolRegistry();

        registry.registerTool(new LogseqReadBlockTool());
        registry.registerTool(new LogseqDataScriptQueryTool());
        registry.registerTool(new SkillTool());
        registry.registerTool(new LogseqInsertBlockTool());
        registry.registerTool(new LogseqCreatePageTool());
        registry.registerTool(new LogseqDeletePageTool());
        registry.registerTool(new LogseqRenamePageTool());
        registry.registerTool(new LogseqTextSearchTool());
        registry.registerTool(new LogseqUpdateBlockTool());
        registry.registerTool(new LogseqMoveBlockTool());
        registry.registerTool(new LogseqClearChangesTool());
        registry.registerTool(new GetUserInfoTool());
        registry.registerTool(new LogseqCommitChangesTool());

        return registry;
    }

    private registerTool<TArgs extends Record<string, unknown>, TResult>(
        tool: BaseChatTool<TArgs, TResult>
    ): void {
        this.tools.set(tool.name, tool.getDefinition());
        if (tool.render) {
            this.toolUIs.set(tool.name, tool.render);
        }
    }
}
