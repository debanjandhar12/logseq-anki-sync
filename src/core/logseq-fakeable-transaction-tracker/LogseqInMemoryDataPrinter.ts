import type {
    InMemoryDB,
    InMemoryLogseqEntity,
    InMemoryPageEntity
} from "./types";
import {
    getPropertySchema,
    getTagExtends,
    getTagPropertyKeys,
    isPropertyPage,
    isSchemaPage,
    isTagPage
} from "./executor/in-memory-executor-utils/schemaPage";

export class LogseqInMemoryDataPrinter {
    public static print(db: InMemoryDB): string {
        const pages = Array.from(db.values());
        const sections = pages
            .filter((page) => !isSchemaPage(page))
            .map((page) => LogseqInMemoryDataPrinter.printPage(page));
        const properties = LogseqInMemoryDataPrinter.printProperties(
            pages.filter(isPropertyPage)
        );
        const tags = LogseqInMemoryDataPrinter.printTags(pages.filter(isTagPage));
        if (properties) sections.push(properties);
        if (tags) sections.push(tags);
        return sections.filter(Boolean).join("\n\n");
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

    private static printBlock(
        entity: InMemoryLogseqEntity,
        depth: number
    ): string[] {
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
        return Object.entries(entity.properties || {})
            .filter(([key]) => key !== "uuid")
            .map(
                ([key, value]) =>
                    `${key}:: ${LogseqInMemoryDataPrinter.stringifyPropertyValue(
                        value,
                        key === "tags"
                    )}`
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

    private static stringifyPropertyValue(value: unknown, readableTags = false): string {
        if (readableTags) {
            const tags = Array.isArray(value) ? value : [value];
            return tags.map((tag) => `[[${String(tag)}]]`).join(", ");
        }
        if (Array.isArray(value)) return JSON.stringify(value);
        if (typeof value === "object" && value !== null) return JSON.stringify(value);
        return String(value);
    }

    private static printProperties(propertyPages: InMemoryPageEntity[]): string {
        if (propertyPages.length === 0) return "";
        const lines = ["Properties"];
        for (const propertyPage of propertyPages) {
            lines.push(`* ${propertyPage.title || propertyPage.name}`);
            for (const [key, value] of Object.entries(getPropertySchema(propertyPage))) {
                lines.push(`  ${key}:: ${LogseqInMemoryDataPrinter.stringifyPropertyValue(value)}`);
            }
        }
        return lines.join("\n");
    }

    private static printTags(tagPages: InMemoryPageEntity[]): string {
        if (tagPages.length === 0) return "";
        const lines = ["Tags"];
        for (const tagPage of tagPages) {
            lines.push(`* ${tagPage.name}`);
            const tagProperties = getTagPropertyKeys(tagPage);
            if (tagProperties.length > 0) {
                lines.push(`  properties:: ${tagProperties.join(", ")}`);
            }
            const extendsTags = getTagExtends(tagPage);
            if (extendsTags.length > 0) {
                lines.push(`  extends:: ${extendsTags.join(", ")}`);
            }
        }
        return lines.join("\n");
    }
}
