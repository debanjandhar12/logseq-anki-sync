import type {ToolCallMessagePartComponent} from "@assistant-ui/react";
import type {Tool} from "assistant-stream";
import type {BaseChatTool} from "src/chat-app/tools/base/BaseChatTool";
import type {ChatToolResult} from "src/chat-app/tools/base/ChatToolResponse";
import {GetUserInfoTool} from "src/chat-app/tools/impl/GetUserInfoTool";
import {LogseqAddPropertyToTagPageTool} from "src/chat-app/tools/impl/LogseqAddPropertyToTagPageTool";
import {LogseqAddTagToBlockTool} from "src/chat-app/tools/impl/LogseqAddTagToBlockTool";
import {LogseqClearChangesTool} from "src/chat-app/tools/impl/LogseqClearChangesTool";
import {LogseqCommitChangesTool} from "src/chat-app/tools/impl/LogseqCommitChangesTool";
import {LogseqCreatePageTool} from "src/chat-app/tools/impl/LogseqCreatePageTool";
import {LogseqCreateTagPageTool} from "src/chat-app/tools/impl/LogseqCreateTagPageTool";
import {LogseqDataScriptQueryTool} from "src/chat-app/tools/impl/LogseqDataScriptQueryTool";
import {LogseqDeletePageTool} from "src/chat-app/tools/impl/LogseqDeletePageTool";
import {LogseqDeletePropertyFromBlockTool} from "src/chat-app/tools/impl/LogseqDeletePropertyFromBlockTool";
import {LogseqInsertBlockTool} from "src/chat-app/tools/impl/LogseqInsertBlockTool";
import {LogseqMoveBlockTool} from "src/chat-app/tools/impl/LogseqMoveBlockTool";
import {LogseqReadBlockTool} from "src/chat-app/tools/impl/LogseqReadBlockTool";
import {LogseqRemovePropertyFromTagPageTool} from "src/chat-app/tools/impl/LogseqRemovePropertyFromTagPageTool";
import {LogseqRemoveTagFromBlockTool} from "src/chat-app/tools/impl/LogseqRemoveTagFromBlockTool";
import {LogseqRenamePageTool} from "src/chat-app/tools/impl/LogseqRenamePageTool";
import {LogseqRestorePageTool} from "src/chat-app/tools/impl/LogseqRestorePageTool";
import {LogseqTextSearchTool} from "src/chat-app/tools/impl/LogseqTextSearchTool";
import {LogseqUpdateBlockTool} from "src/chat-app/tools/impl/LogseqUpdateBlockTool";
import {LogseqUpsertPropertyPageTool} from "src/chat-app/tools/impl/LogseqUpsertPropertyPageTool";
import {LogseqUpsertPropertyToBlockTool} from "src/chat-app/tools/impl/LogseqUpsertPropertyToBlockTool";
import {SkillTool} from "src/chat-app/tools/impl/SkillTool";

export class ChatToolRegistry {
    private static instance: ChatToolRegistry | undefined;

    private readonly tools = new Map<string, Tool<any, any>>();
    private readonly toolUIs = new Map<string, ToolCallMessagePartComponent>();
    private readonly humanToolNames = new Set<string>();

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

    getHumanToolNames(): string[] {
        return [...this.humanToolNames];
    }

    private static createDefault(): ChatToolRegistry {
        const registry = new ChatToolRegistry();

        registry.registerTool(new LogseqReadBlockTool());
        registry.registerTool(new LogseqDataScriptQueryTool());
        registry.registerTool(new SkillTool());
        registry.registerTool(new LogseqInsertBlockTool());
        registry.registerTool(new LogseqCreatePageTool());
        registry.registerTool(new LogseqCreateTagPageTool());
        registry.registerTool(new LogseqDeletePageTool());
        registry.registerTool(new LogseqRenamePageTool());
        registry.registerTool(new LogseqRestorePageTool());
        registry.registerTool(new LogseqTextSearchTool());
        registry.registerTool(new LogseqUpdateBlockTool());
        registry.registerTool(new LogseqMoveBlockTool());
        registry.registerTool(new LogseqUpsertPropertyPageTool());
        registry.registerTool(new LogseqUpsertPropertyToBlockTool());
        registry.registerTool(new LogseqDeletePropertyFromBlockTool());
        registry.registerTool(new LogseqAddPropertyToTagPageTool());
        registry.registerTool(new LogseqRemovePropertyFromTagPageTool());
        registry.registerTool(new LogseqAddTagToBlockTool());
        registry.registerTool(new LogseqRemoveTagFromBlockTool());
        registry.registerTool(new LogseqClearChangesTool());
        registry.registerTool(new GetUserInfoTool());
        registry.registerTool(new LogseqCommitChangesTool());

        return registry;
    }

    private registerTool<TArgs extends Record<string, unknown>, TResult extends ChatToolResult>(
        tool: BaseChatTool<TArgs, TResult>
    ): void {
        this.tools.set(tool.name, tool.getDefinition());
        if (tool.type === "human") {
            this.humanToolNames.add(tool.name);
        }
        if (tool.render) {
            this.toolUIs.set(tool.name, tool.render);
        }
    }
}
