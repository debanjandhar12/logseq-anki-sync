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
import {ReadPdfTool} from "src/chat-app/tools/impl/ReadPdfTool";
import {SkillTool} from "src/chat-app/tools/impl/SkillTool";
import {WebPageGetTool} from "src/chat-app/tools/impl/WebPageGetTool";
import {WebSearchTool} from "src/chat-app/tools/impl/WebSearchTool";
import {ContentParsingProviderEnum, WebToolsProviderEnum} from "src/core/ai-sdk/types";
import {LogseqSettingAccessor} from "src/logseq/LogseqSettingAccessor";

export const ToolkitEnum = {
    LOGSEQ: "logseq",
    WEB: "web",
    PDF: "pdf",
    MISC: "misc"
} as const;
export type ToolkitName = (typeof ToolkitEnum)[keyof typeof ToolkitEnum];

export class ChatToolRegistry {
    private static instance: ChatToolRegistry | undefined;

    private readonly toolkitMap: Record<ToolkitName, Record<string, Tool<any, any>>> = {
        [ToolkitEnum.LOGSEQ]: {},
        [ToolkitEnum.WEB]: {},
        [ToolkitEnum.PDF]: {},
        [ToolkitEnum.MISC]: {}
    };
    private readonly toolUIs = new Map<string, ToolCallMessagePartComponent>();
    private readonly humanToolNames = new Set<string>();

    static getInstance(): ChatToolRegistry {
        if (!ChatToolRegistry.instance) {
            ChatToolRegistry.instance = ChatToolRegistry.createDefault();
        }

        return ChatToolRegistry.instance;
    }

    static reset(): void {
        ChatToolRegistry.instance = undefined;
    }

    getTools(): Record<string, Tool<any, any>> {
        const all: Record<string, Tool<any, any>> = {};
        for (const tools of Object.values(this.toolkitMap)) {
            Object.assign(all, tools);
        }
        return all;
    }

    getToolkit(name: ToolkitName): Record<string, Tool<any, any>> {
        return {...this.toolkitMap[name]};
    }

    getToolkits(): Record<ToolkitName, Record<string, Tool<any, any>>> {
        return {
            [ToolkitEnum.LOGSEQ]: {...this.toolkitMap[ToolkitEnum.LOGSEQ]},
            [ToolkitEnum.WEB]: {...this.toolkitMap[ToolkitEnum.WEB]},
            [ToolkitEnum.PDF]: {...this.toolkitMap[ToolkitEnum.PDF]},
            [ToolkitEnum.MISC]: {...this.toolkitMap[ToolkitEnum.MISC]}
        };
    }

    getToolUIs(): ReadonlyMap<string, ToolCallMessagePartComponent> {
        return this.toolUIs;
    }

    getHumanToolNames(): string[] {
        return [...this.humanToolNames];
    }

    private static createDefault(): ChatToolRegistry {
        const registry = new ChatToolRegistry();
        const settings = LogseqSettingAccessor.getPluginSettings();

        registry.registerTool(new LogseqReadBlockTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqDataScriptQueryTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqInsertBlockTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqCreatePageTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqCreateTagPageTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqDeletePageTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqRenamePageTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqRestorePageTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqTextSearchTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqUpdateBlockTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqMoveBlockTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqUpsertPropertyPageTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqUpsertPropertyToBlockTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqDeletePropertyFromBlockTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqAddPropertyToTagPageTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqRemovePropertyFromTagPageTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqAddTagToBlockTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqRemoveTagFromBlockTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqClearChangesTool(), ToolkitEnum.LOGSEQ);
        registry.registerTool(new LogseqCommitChangesTool(), ToolkitEnum.LOGSEQ);

        if (settings.webToolsProvider === WebToolsProviderEnum.JINA) {
            registry.registerTool(new WebSearchTool(), ToolkitEnum.WEB);
            registry.registerTool(new WebPageGetTool(), ToolkitEnum.WEB);
        }

        if (settings.contentParsingProvider === ContentParsingProviderEnum.LLAMA_CLOUD) {
            registry.registerTool(new ReadPdfTool(), ToolkitEnum.PDF);
        }

        registry.registerTool(new SkillTool(), ToolkitEnum.MISC);
        registry.registerTool(new GetUserInfoTool(), ToolkitEnum.MISC);

        return registry;
    }

    private registerTool<TArgs extends Record<string, unknown>, TResult extends ChatToolResult>(
        tool: BaseChatTool<TArgs, TResult>,
        toolkit: ToolkitName
    ): void {
        this.toolkitMap[toolkit][tool.name] = tool.getDefinition();
        if (tool.type === "human") {
            this.humanToolNames.add(tool.name);
        }
        if (tool.render) {
            this.toolUIs.set(tool.name, tool.render);
        }
    }
}
