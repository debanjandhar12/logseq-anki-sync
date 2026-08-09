import type {BlockEntity, PageEntity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {isPageSoftDeleted} from "src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";

export const NON_EXISTENT_PAGE_NAME = "[DOES NOT EXIST]";

export interface LogseqPrintedPageSnapshot {
    identityKey: string;
    resolvedPageUuid: string | null;
    exists: boolean;
    pageName: string;
    content: string;
}

export interface LogseqPrintedPageChangeSide {
    pageName: string;
    content: string;
}

export interface LogseqPrintedPageChange {
    key: string;
    before: LogseqPrintedPageChangeSide;
    after: LogseqPrintedPageChangeSide;
}

export class LogseqPageDataPrinter {
    public static async print(changedPages: PageIdentity[]): Promise<LogseqPrintedPageSnapshot[]> {
        const printedPages: LogseqPrintedPageSnapshot[] = [];
        const printedPageCache = new Map<string, LogseqPrintedPageChangeSide>();

        for (const pageIdentity of changedPages) {
            const identityKey = LogseqPageDataPrinter.stringifyIdentity(pageIdentity);
            const page = await LogseqPropertiesHelper.getPage(pageIdentity);
            if (!page) {
                printedPages.push(LogseqPageDataPrinter.createMissingSnapshot(identityKey, null));
                continue;
            }

            if (isPageSoftDeleted(page)) {
                printedPages.push(
                    LogseqPageDataPrinter.createMissingSnapshot(identityKey, page.uuid)
                );
                continue;
            }

            let printedPage = printedPageCache.get(page.uuid);
            if (!printedPage) {
                const blocks = await LogseqPropertiesHelper.getPageBlocksTree(page.uuid);
                printedPage = {
                    pageName: page.originalName ?? page.name,
                    content: LogseqPageDataPrinter.printPageTree(page, blocks)
                };
                printedPageCache.set(page.uuid, printedPage);
            }
            printedPages.push({
                identityKey,
                resolvedPageUuid: page.uuid,
                exists: true,
                ...printedPage
            });
        }

        return printedPages;
    }

    public static createChanges(
        before: LogseqPrintedPageSnapshot[],
        after: LogseqPrintedPageSnapshot[]
    ): LogseqPrintedPageChange[] {
        if (before.length !== after.length) {
            throw new Error(
                `Cannot pair page snapshots with different lengths: ${before.length} before and ${after.length} after`
            );
        }

        const parents = before.map((_, index) => index);
        const findRoot = (index: number): number => {
            let root = index;
            while (parents[root] !== root) root = parents[root];
            while (parents[index] !== index) {
                const parent = parents[index];
                parents[index] = root;
                index = parent;
            }
            return root;
        };
        const merge = (left: number, right: number): void => {
            const leftRoot = findRoot(left);
            const rightRoot = findRoot(right);
            if (leftRoot === rightRoot) return;
            parents[Math.max(leftRoot, rightRoot)] = Math.min(leftRoot, rightRoot);
        };
        const firstIndexByUuid = new Map<string, number>();

        for (let index = 0; index < before.length; index += 1) {
            const uuids = new Set(
                [before[index].resolvedPageUuid, after[index].resolvedPageUuid].filter(
                    (uuid): uuid is string => uuid !== null
                )
            );
            for (const uuid of uuids) {
                const firstIndex = firstIndexByUuid.get(uuid);
                if (firstIndex === undefined) firstIndexByUuid.set(uuid, index);
                else merge(firstIndex, index);
            }
        }

        const indexesByRoot = new Map<number, number[]>();
        for (let index = 0; index < before.length; index += 1) {
            const root = findRoot(index);
            const indexes = indexesByRoot.get(root) ?? [];
            indexes.push(index);
            indexesByRoot.set(root, indexes);
        }

        return [...indexesByRoot.values()].flatMap((indexes) => {
            const beforeSide = LogseqPageDataPrinter.selectExistingSide(before, indexes);
            const afterSide = LogseqPageDataPrinter.selectExistingSide(after, indexes);
            if (
                beforeSide.pageName === afterSide.pageName &&
                beforeSide.content === afterSide.content
            ) {
                return [];
            }

            return [
                {
                    key: `changed-page-${indexes[0]}`,
                    before: beforeSide,
                    after: afterSide
                }
            ];
        });
    }

    public static printPageTree(page: PageEntity, blocks: BlockEntity[]): string {
        const lines: string[] = [];

        const pagePropertyLines = LogseqPageDataPrinter.getPropertyLines(page);
        if (pagePropertyLines.length > 0) {
            lines.push(...LogseqPageDataPrinter.printBullet(pagePropertyLines, 0));
        }

        for (const block of blocks) lines.push(...LogseqPageDataPrinter.printBlockTree(block, 0));

        return lines.join("\n");
    }

    private static printBlockTree(block: BlockEntity, depth: number): string[] {
        const propertyLines = LogseqPageDataPrinter.getPropertyLines(block);
        const contentLines = (block.content || block.title || "").trim().split(/\r?\n/);
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
            .flatMap(([key, value]) =>
                `${key}:: ${LogseqPageDataPrinter.stringifyPropertyValue(value)}`.split(/\r?\n/)
            );
    }

    private static printBullet(lines: string[], depth: number): string[] {
        const bulletIndent = "    ".repeat(depth);
        const contentIndent = `${bulletIndent}  `;
        const [firstLine = "", ...remainingLines] = lines;

        return [
            `${bulletIndent}* ${firstLine.trim()}`,
            ...remainingLines.map((line) => `${contentIndent}${line.trim()}`)
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

    private static createMissingSnapshot(
        identityKey: string,
        resolvedPageUuid: string | null
    ): LogseqPrintedPageSnapshot {
        return {
            identityKey,
            resolvedPageUuid,
            exists: false,
            pageName: NON_EXISTENT_PAGE_NAME,
            content: ""
        };
    }

    private static selectExistingSide(
        snapshots: LogseqPrintedPageSnapshot[],
        indexes: number[]
    ): LogseqPrintedPageChangeSide {
        const snapshot = indexes.map((index) => snapshots[index]).find(({exists}) => exists);
        if (!snapshot) return {pageName: NON_EXISTENT_PAGE_NAME, content: ""};
        return {pageName: snapshot.pageName, content: snapshot.content};
    }
}
