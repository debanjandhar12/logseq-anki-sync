import type {EntityID, PageIdentity} from "@logseq/libs/dist/LSPlugin";

type PermanentDeleteEditor = typeof logseq.Editor & {
    deleteRecycledPagePermanently(page: PageIdentity | EntityID): Promise<boolean | null>;
};

/** Removes an active or recycled test page, tag, or property, including its children. */
export async function deletePagePermanently(identity: PageIdentity | EntityID): Promise<void> {
    const property =
        typeof identity === "string" ? await logseq.Editor.getProperty(identity) : null;
    const entity =
        property ??
        (await logseq.Editor.getPage(identity)) ??
        (await logseq.Editor.getBlock(identity));
    if (!entity) return;

    if (property) await logseq.Editor.removeProperty(identity as string);
    const current = await logseq.Editor.getBlock(entity.uuid);
    if (!current) return;
    if (current[":logseq.property/deleted-at"] == null) {
        await logseq.Editor.deletePage(entity.uuid);
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const editor = logseq.Editor as PermanentDeleteEditor;
    await editor.deleteRecycledPagePermanently(entity.uuid);
    await new Promise((resolve) => setTimeout(resolve, 1000));
}
