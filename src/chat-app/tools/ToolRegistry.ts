import type {ToolCallMessagePartComponent} from "@assistant-ui/react";
import type {Tool} from "assistant-stream";
import type {BaseChatTool} from "src/chat-app/tools/base/BaseChatTool";
import {ClearLogseqChangesTool} from "src/chat-app/tools/impl/ClearLogseqChangesTool";
import {CommitLogseqChangesTool} from "src/chat-app/tools/impl/CommitLogseqChangesTool";
import {CreateLogseqPageTool} from "src/chat-app/tools/impl/CreateLogseqPageTool";
import {DataScriptQueryLogseqTool} from "src/chat-app/tools/impl/DataScriptQueryLogseqTool";
import {DeleteLogseqPageTool} from "src/chat-app/tools/impl/DeleteLogseqPageTool";
import {GetUserInfoTool} from "src/chat-app/tools/impl/GetUserInfoTool";
import {InsertLogseqBlockTool} from "src/chat-app/tools/impl/InsertLogseqBlockTool";
import {MoveLogseqBlockTool} from "src/chat-app/tools/impl/MoveLogseqBlockTool";
import {ReadLogseqBlockTool} from "src/chat-app/tools/impl/ReadLogseqBlockTool";
import {ReadSkillFileTool} from "src/chat-app/tools/impl/ReadSkillFileTool";
import {RenameLogseqPageTool} from "src/chat-app/tools/impl/RenameLogseqPageTool";
import {UpdateLogseqBlockTool} from "src/chat-app/tools/impl/UpdateLogseqBlockTool";

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

        registry.registerTool(new ReadLogseqBlockTool());
        registry.registerTool(new DataScriptQueryLogseqTool());
        registry.registerTool(new ReadSkillFileTool());
        registry.registerTool(new InsertLogseqBlockTool());
        registry.registerTool(new CreateLogseqPageTool());
        registry.registerTool(new DeleteLogseqPageTool());
        registry.registerTool(new RenameLogseqPageTool());
        registry.registerTool(new UpdateLogseqBlockTool());
        registry.registerTool(new MoveLogseqBlockTool());
        registry.registerTool(new ClearLogseqChangesTool());
        registry.registerTool(new GetUserInfoTool());
        registry.registerTool(new CommitLogseqChangesTool());

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
