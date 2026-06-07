import type {InMemoryDB, InMemoryLogseqEntity, InMemoryPageEntity} from "./types";

export class LogseqInMemoryDataPrinter {
    public static print(db: InMemoryDB): string {
        return Array.from(db.values())
            .map((page) => LogseqInMemoryDataPrinter.printPage(page))
            .join("\n\n");
    }

    private static printPage(page: InMemoryPageEntity): string {
        const lines: string[] = [];
        const pagePropertyLines = LogseqInMemoryDataPrinter.getPropertyLines(page);
        if (pagePropertyLines.length > 0) {
            lines.push(...LogseqInMemoryDataPrinter.printBullet(pagePropertyLines, 0));
        }
        for (const child of page.children || []) {
            lines.push(...LogseqInMemoryDataPrinter.printBlock(child, 0));
        }

        return lines.join("\n");
    }

    private static printBlock(entity: InMemoryLogseqEntity, depth: number): string[] {
        if (LogseqInMemoryDataPrinter.isPageEntity(entity)) return [];

        const propertyLines = LogseqInMemoryDataPrinter.getPropertyLines(entity);
        const contentLines = (entity.content || entity.title || "").trim().split("\n");
        const lines = LogseqInMemoryDataPrinter.printBullet(
            [...propertyLines, ...contentLines],
            depth
        );

        for (const child of entity.children || []) {
            lines.push(...LogseqInMemoryDataPrinter.printBlock(child, depth + 1));
        }

        return lines;
    }

    private static isPageEntity(entity: InMemoryLogseqEntity): entity is InMemoryPageEntity {
        return entity.type === "page";
    }

    private static getPropertyLines(entity: InMemoryLogseqEntity): string[] {
        return Object.entries(entity.properties || {}).map(
            ([key, value]) => `${key}:: ${LogseqInMemoryDataPrinter.stringifyPropertyValue(value)}`
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

    private static stringifyPropertyValue(value: unknown): string {
        if (Array.isArray(value)) return JSON.stringify(value);
        if (typeof value === "object" && value !== null) return JSON.stringify(value);
        return String(value);
    }
}
