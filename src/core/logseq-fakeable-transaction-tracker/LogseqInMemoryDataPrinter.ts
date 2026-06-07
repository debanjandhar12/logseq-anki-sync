import type {InMemoryDB, InMemoryLogseqEntity, InMemoryPageEntity} from "./types";

export class LogseqInMemoryDataPrinter {
    public static print(db: InMemoryDB): string {
        return Array.from(db.values())
            .map((page) => LogseqInMemoryDataPrinter.printPage(page))
            .join("\n\n");
    }

    private static printPage(page: InMemoryPageEntity): string {
        const lines = [];
        for (const child of page.children || []) {
            lines.push(...LogseqInMemoryDataPrinter.printBlock(child, 0));
        }

        return lines.join("\n");
    }

    private static printBlock(entity: InMemoryLogseqEntity, depth: number): string[] {
        if (LogseqInMemoryDataPrinter.isPageEntity(entity)) return [];

        const lines: string[] = [];
        const bulletIndent = "    ".repeat(depth);
        const contentIndent = `${bulletIndent}  `;
        const contentLines = (entity.content || entity.title || "").trim().split("\n");

        lines.push(`${bulletIndent}* ${contentLines[0]}`);
        for (const contentLine of contentLines.slice(1)) {
            lines.push(`${contentIndent}${contentLine}`);
        }

        for (const child of entity.children || []) {
            lines.push(...LogseqInMemoryDataPrinter.printBlock(child, depth + 1));
        }

        return lines;
    }

    private static isPageEntity(entity: InMemoryLogseqEntity): entity is InMemoryPageEntity {
        return entity.type === "page";
    }
}
