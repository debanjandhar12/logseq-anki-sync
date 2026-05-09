import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {createLogger, LoggerCategory} from "../logger";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";
import {LogseqAppInfoFetcher} from "../logseq/LogseqAppInfoFetcher";
import {LogseqProxy} from "../logseq/LogseqProxy";

const logger = createLogger(LoggerCategory.Others);

/**
 * ObjectPropertyDataManager - Handles saving and loading object data
 * from Logseq block properties with proper encoding based on graph type.
 *
 * For DB graphs: Data is stored as backtick-wrapped JSON string
 * For non-DB graphs: Data is stored as base64-encoded JSON string
 */
export class ObjectPropertyDataManager {
    /**
     * Save an object to a property value with appropriate encoding
     * @param data - The object to save
     * @returns Promise<string> - The encoded string to store in property
     */
    static async save(
        block: BlockEntity | {uuid: string; properties?: any},
        propertyName: string,
        data: object
    ): Promise<string> {
        const jsonString = JSON.stringify(data);
        const isDbGraph = await LogseqAppInfoFetcher.checkCurrentIsDbGraph();

        let encoded: string;
        if (isDbGraph) {
            const escapedJsonString = jsonString.replace(/`/g, "\\u0060"); // Replace backticks with their unicode escape sequence
            encoded = `\`${escapedJsonString}\``; // Backticks added to make it appear as code in logseq db ver
        } else {
            encoded = Buffer.from(jsonString, "utf8").toString("base64");
        }

        const existingValue = block.properties?.[propertyName];
        if (existingValue !== encoded) {
            await LogseqProxy.Editor.upsertBlockProperty(
                getUUIDFromBlock(block as BlockEntity),
                propertyName,
                encoded
            );
        }

        return encoded;
    }

    /**
     * Load an object from a property value, handling both encoding formats
     * @param value - The property value to parse (may be base64 or JSON string)
     * @returns object | null - The parsed object, or null if parsing fails
     */
    static load(block: BlockEntity | {properties?: any}, propertyName: string): object | null {
        let value = block.properties?.[propertyName];
        if (!value) {
            return null;
        }

        try {
            // Strip backticks if present (In DB graphs, we add them to make them appear as code in logseq)
            if (typeof value === "string" && value.startsWith("`") && value.endsWith("`")) {
                value = value.slice(1, -1);
            }

            // First, try to parse as JSON directly (DB graph format)
            const parsed = JSON.parse(value);
            if (typeof parsed === "object" && parsed !== null) {
                return parsed;
            }
        } catch {
            // Not a direct JSON string, try base64 decoding
        }

        try {
            // Try to decode as base64 (non-DB graph format)
            const decoded = Buffer.from(value, "base64").toString("utf8");
            const parsed = JSON.parse(decoded);
            if (typeof parsed === "object" && parsed !== null) {
                return parsed;
            }
        } catch (e) {
            logger.warn("Failed to load property data:", e);
        }

        return null;
    }

    /**
     * Validate if a property value can be loaded as an object
     * @param value - The property value to validate
     * @returns boolean - true if the value can be parsed as an object
     */
    static validate(block: BlockEntity | {properties?: any}, propertyName: string): boolean {
        return ObjectPropertyDataManager.load(block, propertyName) !== null;
    }
}
