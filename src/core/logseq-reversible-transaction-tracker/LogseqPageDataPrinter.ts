import type {BlockEntity, PageEntity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {isPageSoftDeleted} from "src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";

export class LogseqPageDataPrinter {
    public static async print(changedPages: PageIdentity[]): Promise<string> {
        const printedPages: string[] = [];
        const printedPageUUIDs = new Set<string>();
        const printedMissingPageKeys = new Set<string>();

        for (const pageIdentity of changedPages) {
            const page = await LogseqPropertiesHelper.getPage(pageIdentity);
            if (!page) {
                const key = LogseqPageDataPrinter.stringifyIdentity(pageIdentity);
                if (printedMissingPageKeys.has(key)) continue;

                printedMissingPageKeys.add(key);
                printedPages.push(`# ${key}\n<Page not found>`);
                continue;
            }

            if (printedPageUUIDs.has(page.uuid)) continue;

            printedPageUUIDs.add(page.uuid);
            const blocks = await LogseqPropertiesHelper.getPageBlocksTree(page.uuid);
            printedPages.push(LogseqPageDataPrinter.printPageTree(page, blocks));
        }

        return printedPages.join("\n\n");
    }

    public static printPageTree(page: PageEntity, blocks: BlockEntity[]): string {
        const lines = [`# ${page.originalName ?? page.name}`];
        if (isPageSoftDeleted(page)) return lines.join("\n");

        const pagePropertyLines = LogseqPageDataPrinter.getPropertyLines(page);
        if (pagePropertyLines.length > 0) {
            lines.push(...LogseqPageDataPrinter.printBullet(pagePropertyLines, 0));
        }

        for (const block of blocks) lines.push(...LogseqPageDataPrinter.printBlockTree(block, 0));

        return lines.join("\n");
    }

    private static printBlockTree(block: BlockEntity, depth: number): string[] {
        const propertyLines = LogseqPageDataPrinter.getPropertyLines(block);
        const contentLines = (block.content || block.title || "").trim().split("\n");
        const lines = LogseqPageDataPrinter.printBullet([...propertyLines, ...contentLines], depth);

        for (const child of block.children || []) {
            if (Array.isArray(child)) continue;
            lines.push(...LogseqPageDataPrinter.printBlockTree(child, depth + 1));
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
