import type {InMemoryDB, InMemoryLogseqEntity, InMemoryPageEntity} from "./types";

export class LogseqInMemoryDataPrinter {
    public static print(db: InMemoryDB): string {
        return Array.from(db.values())
            .map((page) => LogseqInMemoryDataPrinter.printPage(page))
            .join("\n\n");
    }

    private static printPage(page: InMemoryPageEntity): string {
        const lines = [`# ${page.title || page.name}`];
        for (const child of page.children || []) {
            lines.push(...LogseqInMemoryDataPrinter.printBlock(child as InMemoryLogseqEntity, 0));
        }

        return lines.join("\n");
    }

    private static printBlock(entity: InMemoryLogseqEntity, depth: number): string[] {
        if (LogseqInMemoryDataPrinter.isPageEntity(entity)) return [];

        const lines: string[] = [];
        const bulletIndent = "    ".repeat(depth);
        const contentIndent = `${bulletIndent}  `;
        const properties = LogseqInMemoryDataPrinter.getPrintableProperties(
            entity.properties || {}
        );
        const content = entity.content || entity.title || "";

        if (properties.length > 0) {
            const [firstProperty, ...remainingProperties] = properties;
            lines.push(`${bulletIndent}- ${firstProperty}`);
            lines.push(...remainingProperties.map((property) => `${contentIndent}${property}`));
            if (content) lines.push(`${contentIndent}${content}`);
        } else {
            lines.push(`${bulletIndent}- ${content}`);
        }

        for (const child of entity.children || []) {
            lines.push(
                ...LogseqInMemoryDataPrinter.printBlock(child as InMemoryLogseqEntity, depth + 1)
            );
        }

        return lines;
    }

    private static getPrintableProperties(properties: Record<string, any>): string[] {
        return Object.entries(properties)
            .filter(([key]) => key !== "uuid" && !key.startsWith("logseq."))
            .map(
                ([key, value]) => `${key}:: ${LogseqInMemoryDataPrinter.stringifyProperty(value)}`
            );
    }

    private static stringifyProperty(value: any): string {
        if (value === null || value === undefined) return "";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
    }

    private static isPageEntity(entity: InMemoryLogseqEntity): entity is InMemoryPageEntity {
        return "name" in entity && "type" in entity;
    }
}
