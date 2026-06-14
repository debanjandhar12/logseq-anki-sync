import type {BlockIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "../../../logseq/LogseqEditor";
import {LogseqPropertiesHelper} from "../../../logseq/LogseqPropertiesHelper";
import type {LogseqEntityIdentity} from "../types";
import {
    DEFAULT_INSERT_BLOCK_OPTIONS,
    DEFAULT_MOVE_BLOCK_OPTIONS,
    type InsertBlockOptions,
    LogseqTransactionExecutor,
    type MoveBlockOptions
} from "./LogseqTransactionExecutor";

export class LogseqExecutor extends LogseqTransactionExecutor {
    public async insertBlock(
        parentBlockUUID: LogseqEntityIdentity,
        content: string,
        options: InsertBlockOptions = DEFAULT_INSERT_BLOCK_OPTIONS
    ): Promise<boolean> {
        const block = await logseq.Editor.insertBlock(parentBlockUUID, content, {
            ...DEFAULT_INSERT_BLOCK_OPTIONS,
            ...options,
            customUUID: this.uuidGenerator.getUUID()
        });
        if (!block) {
            throw new Error(`Logseq failed to insert block under parent: ${parentBlockUUID}`);
        }

        return this.pushAndReturn(block, true);
    }

    public async moveBlock(
        srcBlockUUID: LogseqEntityIdentity,
        destBlockUUID: LogseqEntityIdentity,
        options: MoveBlockOptions = DEFAULT_MOVE_BLOCK_OPTIONS
    ): Promise<boolean> {
        await logseq.Editor.moveBlock(
            srcBlockUUID as BlockIdentity,
            destBlockUUID as BlockIdentity,
            {
                ...DEFAULT_MOVE_BLOCK_OPTIONS,
                ...options
            }
        );
        return this.pushAndReturn(true, true);
    }

    public async updateBlock(blockUUID: LogseqEntityIdentity, content: string): Promise<boolean> {
        await LogseqEditor.updateBlock(blockUUID, content);
        return this.pushAndReturn(true, true);
    }

    public async createPage(pageName: string): Promise<boolean> {
        const page = await logseq.Editor.createPage(pageName, undefined, {
            redirect: false,
            customUUID: this.uuidGenerator.getUUID()
        });
        if (!page) {
            throw new Error(`Logseq failed to create page: ${pageName}`);
        }

        return this.pushAndReturn(page, true);
    }

    public async deletePage(pageIdentity: LogseqEntityIdentity): Promise<boolean> {
        const pageName = await this.getPageName(pageIdentity, "deletePage");
        await logseq.Editor.deletePage(pageName);
        return this.pushAndReturn(true, true);
    }

    public async renamePage(pageIdentity: LogseqEntityIdentity, newName: string): Promise<boolean> {
        const pageName = await this.getPageName(pageIdentity, "renamePage");
        await logseq.Editor.renamePage(pageName, newName);
        return this.pushAndReturn(true, true);
    }

    private async getPageName(
        identity: LogseqEntityIdentity,
        operationName: string
    ): Promise<string> {
        const page = await LogseqPropertiesHelper.getPage(identity);
        if (!page?.name) {
            throw new Error(`Logseq failed to resolve page during ${operationName}: ${identity}`);
        }

        return page.name;
    }
}
