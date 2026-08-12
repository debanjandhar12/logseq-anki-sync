import type {ThreadMessage, ToolCallMessagePart} from "@assistant-ui/react";
import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {generateTitle} from "../../core/title-generator/generateTitle";
import {LogseqEditor} from "../../logseq/LogseqEditor";

export type DesiredLogseqBlockIcon = "message-user" | "message-chatbot" | null;

export interface DesiredLogseqBlock {
    content: string;
    children: DesiredLogseqBlock[];
    icon: DesiredLogseqBlockIcon;
    collapseToolCall: boolean;
}

export interface ChatPageExporterDependencies {
    getPage: typeof LogseqEditor.getPage;
    createPage: typeof LogseqEditor.createPage;
    getPageBlocksTree: typeof LogseqEditor.getPageBlocksTree;
    insertBlock: typeof LogseqEditor.insertBlock;
    updateBlock: typeof LogseqEditor.updateBlock;
    removeBlock: typeof LogseqEditor.removeBlock;
    setBlockIcon: typeof LogseqEditor.setBlockIcon;
    removeBlockIcon: typeof LogseqEditor.removeBlockIcon;
    setBlockCollapsed: typeof LogseqEditor.setBlockCollapsed;
}

export class ChatPageExporter {
    private static readonly defaultDependencies: ChatPageExporterDependencies = {
        getPage: LogseqEditor.getPage.bind(LogseqEditor),
        createPage: LogseqEditor.createPage.bind(LogseqEditor),
        getPageBlocksTree: LogseqEditor.getPageBlocksTree.bind(LogseqEditor),
        insertBlock: LogseqEditor.insertBlock.bind(LogseqEditor),
        updateBlock: LogseqEditor.updateBlock.bind(LogseqEditor),
        removeBlock: LogseqEditor.removeBlock.bind(LogseqEditor),
        setBlockIcon: LogseqEditor.setBlockIcon.bind(LogseqEditor),
        removeBlockIcon: LogseqEditor.removeBlockIcon.bind(LogseqEditor),
        setBlockCollapsed: LogseqEditor.setBlockCollapsed.bind(LogseqEditor)
    };

    static async resolveTitle(
        threadId: string,
        messages: readonly ThreadMessage[],
        activeTitle?: string,
        storedTitle?: string
    ): Promise<string> {
        return (
            activeTitle?.trim() || storedTitle?.trim() || (await generateTitle(threadId, messages))
        );
    }

    static createPageName(threadId: string, threadTitle: string): string {
        return `_chat_export_${threadId}_${threadTitle.trim()}`;
    }

    static createBlockTree(messages: readonly ThreadMessage[]): DesiredLogseqBlock[] {
        const rootBlocks: DesiredLogseqBlock[] = [];
        let currentUserBlock: DesiredLogseqBlock | undefined;

        for (const message of messages) {
            if (message.role === "system") continue;
            if (message.role === "user") {
                currentUserBlock = {
                    content: message.content
                        .flatMap((part) => (part.type === "text" ? [part.text] : []))
                        .join("\n\n"),
                    children: [],
                    icon: "message-user",
                    collapseToolCall: false
                };
                rootBlocks.push(currentUserBlock);
                continue;
            }

            if (!currentUserBlock) {
                throw new Error(
                    "Cannot export an assistant message without a preceding user message"
                );
            }
            for (const part of message.content) {
                if (part.type === "text") {
                    currentUserBlock.children.push({
                        content: part.text,
                        children: [],
                        icon: "message-chatbot",
                        collapseToolCall: false
                    });
                } else if (part.type === "tool-call") {
                    currentUserBlock.children.push(ChatPageExporter.createToolCallBlock(part));
                }
            }
        }

        return rootBlocks;
    }

    static async exportPage(
        pageName: string,
        desiredBlocks: readonly DesiredLogseqBlock[],
        dependencies: ChatPageExporterDependencies = ChatPageExporter.defaultDependencies
    ): Promise<{pageName: string; pageUuid: string}> {
        if (desiredBlocks.length === 0) {
            throw new Error("Chat has no user messages to export");
        }
        const page = await ChatPageExporter.getOrCreatePage(pageName, dependencies);
        const currentBlocks = await dependencies.getPageBlocksTree(page.uuid);
        await ChatPageExporter.reconcileChildren(
            pageName,
            page.uuid,
            currentBlocks,
            desiredBlocks,
            dependencies,
            []
        );
        return {pageName, pageUuid: page.uuid};
    }

    private static async getOrCreatePage(
        pageName: string,
        dependencies: ChatPageExporterDependencies
    ): Promise<PageEntity> {
        const existingPage = await dependencies.getPage(pageName);
        if (existingPage) return existingPage;

        const createdPage = await dependencies.createPage(pageName);
        const page = createdPage ?? (await dependencies.getPage(pageName));
        if (!page) throw new Error(`Unable to create export page: ${pageName}`);
        return page;
    }

    private static async reconcileChildren(
        pageName: string,
        parentUuid: string,
        currentChildren: readonly BlockEntity[],
        desiredChildren: readonly DesiredLogseqBlock[],
        dependencies: ChatPageExporterDependencies,
        parentPath: readonly number[]
    ): Promise<void> {
        const sharedCount = Math.min(currentChildren.length, desiredChildren.length);
        for (let index = 0; index < sharedCount; index += 1) {
            const current = currentChildren[index];
            const desired = desiredChildren[index];
            const path = [...parentPath, index];
            if ((current.content ?? "") !== desired.content) {
                await ChatPageExporter.runReconciliationOperation(
                    "update",
                    pageName,
                    parentUuid,
                    path,
                    () => dependencies.updateBlock(current.uuid, desired.content)
                );
            }
            await ChatPageExporter.reconcileBlockIcon(
                pageName,
                parentUuid,
                current.uuid,
                path,
                desired.icon,
                dependencies
            );
            await ChatPageExporter.reconcileChildren(
                pageName,
                current.uuid,
                ChatPageExporter.getBlockChildren(current),
                desired.children,
                dependencies,
                path
            );
            await ChatPageExporter.collapseToolCallBlock(
                pageName,
                parentUuid,
                current.uuid,
                path,
                desired.collapseToolCall,
                dependencies
            );
        }

        for (let index = currentChildren.length - 1; index >= desiredChildren.length; index -= 1) {
            await ChatPageExporter.runReconciliationOperation(
                "remove",
                pageName,
                parentUuid,
                [...parentPath, index],
                () => dependencies.removeBlock(currentChildren[index].uuid)
            );
        }

        for (let index = currentChildren.length; index < desiredChildren.length; index += 1) {
            const desired = desiredChildren[index];
            const path = [...parentPath, index];
            const inserted = await ChatPageExporter.runReconciliationOperation(
                "insert",
                pageName,
                parentUuid,
                path,
                () => dependencies.insertBlock(parentUuid, desired.content)
            );
            if (desired.icon) {
                await ChatPageExporter.setBlockIcon(
                    pageName,
                    parentUuid,
                    inserted.uuid,
                    path,
                    desired.icon,
                    dependencies
                );
            }
            await ChatPageExporter.reconcileChildren(
                pageName,
                inserted.uuid,
                [],
                desired.children,
                dependencies,
                path
            );
            await ChatPageExporter.collapseToolCallBlock(
                pageName,
                parentUuid,
                inserted.uuid,
                path,
                desired.collapseToolCall,
                dependencies
            );
        }
    }

    private static async reconcileBlockIcon(
        pageName: string,
        parentUuid: string,
        blockUuid: string,
        path: readonly number[],
        icon: DesiredLogseqBlockIcon,
        dependencies: ChatPageExporterDependencies
    ): Promise<void> {
        if (icon) {
            await ChatPageExporter.setBlockIcon(
                pageName,
                parentUuid,
                blockUuid,
                path,
                icon,
                dependencies
            );
            return;
        }

        await ChatPageExporter.runReconciliationOperation(
            "remove icon",
            pageName,
            parentUuid,
            path,
            () => dependencies.removeBlockIcon(blockUuid),
            blockUuid
        );
    }

    private static async setBlockIcon(
        pageName: string,
        parentUuid: string,
        blockUuid: string,
        path: readonly number[],
        icon: Exclude<DesiredLogseqBlockIcon, null>,
        dependencies: ChatPageExporterDependencies
    ): Promise<void> {
        await ChatPageExporter.runReconciliationOperation(
            "set icon",
            pageName,
            parentUuid,
            path,
            () => dependencies.setBlockIcon(blockUuid, icon),
            blockUuid
        );
    }

    private static async collapseToolCallBlock(
        pageName: string,
        parentUuid: string,
        blockUuid: string,
        path: readonly number[],
        collapseToolCall: boolean,
        dependencies: ChatPageExporterDependencies
    ): Promise<void> {
        if (!collapseToolCall) return;

        await ChatPageExporter.runReconciliationOperation(
            "collapse",
            pageName,
            parentUuid,
            path,
            () => dependencies.setBlockCollapsed(blockUuid, true),
            blockUuid
        );
    }

    private static async runReconciliationOperation<T>(
        operation: "update" | "remove" | "insert" | "set icon" | "remove icon" | "collapse",
        pageName: string,
        parentUuid: string,
        path: readonly number[],
        action: () => Promise<T>,
        blockUuid?: string
    ): Promise<T> {
        try {
            return await action();
        } catch (error) {
            const blockContext = blockUuid ? `, block: ${blockUuid}` : "";
            throw new Error(
                `Failed to ${operation} export page block (page: ${pageName}, parent: ${parentUuid}${blockContext}, path: ${path.join(".")})`,
                {cause: error}
            );
        }
    }

    private static getBlockChildren(block: BlockEntity): BlockEntity[] {
        const children = block.children ?? [];
        if (children.some(Array.isArray)) {
            throw new Error(`Block tree contains unresolved children: ${block.uuid}`);
        }
        return children as BlockEntity[];
    }

    private static createToolCallBlock(part: ToolCallMessagePart): DesiredLogseqBlock {
        const result = Object.hasOwn(part, "result") ? part.result : null;
        return {
            content: `Tool Call: ${part.toolName}`,
            icon: "message-chatbot",
            collapseToolCall: true,
            children: [
                {
                    content: ChatPageExporter.formatToolValueBlock(
                        "Tool Args",
                        ChatPageExporter.serializeToolValue(part.args, "arguments")
                    ),
                    children: [],
                    icon: null,
                    collapseToolCall: false
                },
                {
                    content: ChatPageExporter.formatToolValueBlock(
                        "Tool Result",
                        ChatPageExporter.serializeToolValue(result, "result")
                    ),
                    children: [],
                    icon: null,
                    collapseToolCall: false
                }
            ]
        };
    }

    private static formatToolValueBlock(label: string, serializedValue: string): string {
        return `${label}:\n\`\`\`json\n${serializedValue}\n\`\`\``;
    }

    private static serializeToolValue(value: unknown, label: string): string {
        let serialized: string | undefined;
        try {
            serialized = JSON.stringify(value);
        } catch (error) {
            throw new Error(`Unable to serialize tool ${label}`, {cause: error});
        }
        if (serialized === undefined) throw new Error(`Unable to serialize tool ${label}`);
        return serialized;
    }
}
