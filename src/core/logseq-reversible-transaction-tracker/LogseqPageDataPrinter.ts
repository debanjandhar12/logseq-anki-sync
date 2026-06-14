import type {BlockEntity, PageEntity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";

export class LogseqPageDataPrinter {
    public static async print(changedPages: PageIdentity[]): Promise<string> {
        const uniquePages = LogseqPageDataPrinter.getUniquePages(changedPages);
        const printedPages = await Promise.all(
            uniquePages.map(async (pageIdentity) => {
                const pageUUID =
                    typeof pageIdentity === "object" ? pageIdentity.uuid : pageIdentity;
                const page = await LogseqPropertiesHelper.getPage(pageUUID);
                if (!page)
                    return `# ${LogseqPageDataPrinter.stringifyIdentity(pageIdentity)}\n<Page not found>`;

                const blocks = await LogseqPropertiesHelper.getPageBlocksTree(page.uuid);
                return LogseqPageDataPrinter.printPage(page, blocks);
            })
        );

        return printedPages.join("\n\n");
    }

    private static getUniquePages(changedPages: PageIdentity[]): PageIdentity[] {
        const seen = new Set<string>();
        return changedPages.filter((page) => {
            const key = LogseqPageDataPrinter.stringifyIdentity(page);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private static printPage(page: PageEntity, blocks: BlockEntity[]): string {
        const lines = [`# ${page.originalName ?? page.name}`];
        const pagePropertyLines = LogseqPageDataPrinter.getPropertyLines(page);
        if (pagePropertyLines.length > 0) {
            lines.push(...LogseqPageDataPrinter.printBullet(pagePropertyLines, 0));
        }

        for (const block of blocks) lines.push(...LogseqPageDataPrinter.printBlock(block, 0));

        return lines.join("\n");
    }

    private static printBlock(block: BlockEntity, depth: number): string[] {
        const propertyLines = LogseqPageDataPrinter.getPropertyLines(block);
        const contentLines = (block.content || block.title || "").trim().split("\n");
        const lines = LogseqPageDataPrinter.printBullet([...propertyLines, ...contentLines], depth);

        for (const child of block.children || []) {
            if (Array.isArray(child)) continue;
            lines.push(...LogseqPageDataPrinter.printBlock(child, depth + 1));
        }

        return lines;
    }

    private static getPropertyLines(entity: BlockEntity | PageEntity): string[] {
        return Object.entries(entity.properties || {})
            .filter(([key]) => key !== "uuid")
            .map(
                ([key, value]) => `${key}:: ${LogseqPageDataPrinter.stringifyPropertyValue(value)}`
            );
    }

    private static printBullet(lines: string[], depth: number): string[] {
        const bulletIndent = "    ".repeat(depth);
        const contentIndent = `${bulletIndent}  `;
        const [firstLine = "", ...remainingLines] = lines;

        return [
            `${bulletIndent}* ${firstLine}`,
            ...remainingLines.map((line) => `${contentIndent}${line}`)
        ];
    }

    private static stringifyIdentity(identity: PageIdentity): string {
        if (typeof identity === "object") return identity.uuid;
        return String(identity);
    }

    private static stringifyPropertyValue(value: unknown): string {
        if (Array.isArray(value)) return JSON.stringify(value);
        if (typeof value === "object" && value !== null) return JSON.stringify(value);
        return String(value);
    }
}
