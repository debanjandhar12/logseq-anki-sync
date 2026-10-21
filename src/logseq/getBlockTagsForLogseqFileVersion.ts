import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import getNameFromPage from "./getNameFromPage";

/**
 * Returns list of tags for logseq file version since logseq does not provide any dedicated api for this.
 * Note: This should not be use directly without concurrency safety.
 */
export async function getBlockTagsForLogseqFileVersion(block: BlockEntity): Promise<string[]> {
    const content = block.content || "";
    if (!content.includes("#") || !Number.isSafeInteger(block.id)) return [];

    // Sync hydration already holds LogseqProxy's semaphore; do not reacquire it.
    const pages: [PageEntity][] = await logseq.DB.datascriptQuery(`[:find
            (pull ?ref [:block/name :block/original-name])
            :where
            [${block.id} :block/refs ?ref]
            [?ref :block/name]]`);

    const matches: {name: string; position: number}[] = [];
    for (const [page] of pages || []) {
        // Datascript pulls retain kebab-case attribute names in file graphs.
        const originalName = page["original-name"];
        const name = typeof originalName === "string" ? originalName : getNameFromPage(page);
        if (typeof name !== "string" || !name) continue;
        const spellings = new Set(
            [name, page.name].filter(
                (value): value is string => typeof value === "string" && !!value
            )
        );
        let position = Infinity;
        for (const spelling of spellings) {
            const escaped = spelling.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            // Do not confuse prefixes (depth-1/depth-10), namespace ancestors,
            // URL fragments or escaped hashes with standalone hashtag tokens.
            const boundary = `[\\s,.;:!?()\\[\\]{}"'<>]`;
            const pattern = new RegExp(
                `(^|${boundary})(#\\[\\[${escaped}\\]\\]|#${escaped}(?=$|${boundary}))`,
                "giu"
            );
            const match = pattern.exec(content);
            if (match) position = Math.min(position, match.index + match[1].length);
        }
        if (Number.isFinite(position)) matches.push({name, position});
    }

    // Datascript row order is unspecified; depth-* precedence follows source order.
    matches.sort((a, b) => a.position - b.position);
    return [...new Set(matches.map(({name}) => name))];
}
