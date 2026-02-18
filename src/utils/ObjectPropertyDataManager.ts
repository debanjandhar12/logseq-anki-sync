import {LogseqAppInfoFetcher} from "../logseq/LogseqAppInfoFetcher";
import {createLogger, LoggerCategory} from "./logger";

const logger = createLogger(LoggerCategory.Others);

/**
 * ObjectPropertyDataManager - Handles saving and loading object data
 * from Logseq block properties with proper encoding based on graph type.
 *
 * For DB graphs: Data is stored as JSON string directly
 * For non-DB graphs: Data is stored as base64-encoded JSON string
 */
export class ObjectPropertyDataManager {
    /**
     * Save an object to a property value with appropriate encoding
     * @param data - The object to save
     * @returns Promise<string> - The encoded string to store in property
     */
    static async save(data: object): Promise<string> {
        const jsonString = JSON.stringify(data);
        const isDbGraph = await LogseqAppInfoFetcher.checkCurrentIsDbGraph();

        if (isDbGraph) {
            // DB graphs: save data directly after JSON.stringify
            return jsonString;
        } else {
            // Non-DB graphs: save data after JSON.stringify and then base64
            return Buffer.from(jsonString, "utf8").toString("base64");
        }
    }

    /**
     * Load an object from a property value, handling both encoding formats
     * @param value - The property value to parse (may be base64 or JSON string)
     * @returns object | null - The parsed object, or null if parsing fails
     */
    static load(value: string | undefined | null): object | null {
        if (!value) {
            return null;
        }

        try {
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
    static validate(value: string | undefined | null): boolean {
        return this.load(value) !== null;
    }
}
