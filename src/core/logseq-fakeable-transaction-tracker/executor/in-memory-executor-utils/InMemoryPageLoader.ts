import type {
    BlockEntity,
    BlockIdentity,
    EntityID,
    PageEntity,
    PageIdentity
} from "@logseq/libs/dist/LSPlugin";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";

export type LoadedInMemoryPage = {
    page: PageEntity;
    blocks: BlockEntity[];
};

export interface InMemoryPageLoader {
    loadPageForIdentity(
        identity: PageIdentity | BlockIdentity | EntityID
    ): Promise<LoadedInMemoryPage | null>;
}

export class LogseqInMemoryPageLoader implements InMemoryPageLoader {
    public async loadPageForIdentity(
        identity: PageIdentity | BlockIdentity | EntityID
    ): Promise<LoadedInMemoryPage | null> {
        const page = await this.resolvePageForIdentity(identity);
        if (!page) return null;

        return {
            page,
            blocks: await LogseqPropertiesHelper.getPageBlocksTree(page.uuid)
        };
    }

    private async resolvePageForIdentity(
        identity: PageIdentity | BlockIdentity | EntityID
    ): Promise<PageEntity | null> {
        try {
            const page = await LogseqPropertiesHelper.getPage(identity as PageIdentity | EntityID);
            if (page) return page;
        } catch (_error) {
            // Entities created only in memory do not exist in Logseq.
        }

        try {
            const block = await LogseqPropertiesHelper.getBlock(
                identity as BlockIdentity | EntityID
            );
            const pageId = getReferenceId(block?.page);
            if (!pageId) return null;
            return await LogseqPropertiesHelper.getPage(pageId);
        } catch (_error) {
            return null;
        }
    }
}

function getReferenceId(reference: unknown): EntityID | undefined {
    if (typeof reference === "number") return reference;
    if (typeof reference === "object" && reference !== null && "id" in reference) {
        const id = (reference as {id?: unknown}).id;
        return typeof id === "number" ? id : undefined;
    }
    return undefined;
}
