import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LogseqPropertiesHelper } from "../../../src/logseq/LogseqPropertiesHelper";

describe("LogseqPropertiesHelper.stripPropertyPrefixes", () => {
    it("should strip :user.property/name-suffix format to just name", () => {
        const input = {
            ":user.property/deck-bavZ5684": "test-deck",
            ":user.property/tags-xyz123": "a,b",
            ":user.property/occlusion-abc": "true"
        };

        const result = LogseqPropertiesHelper.stripPropertyPrefixes(input);

        expect(result).toEqual({
            deck: "test-deck",
            tags: ["a", "b"],
            occlusion: "true"
        });
    });

    it("should handle :block/property format", () => {
        const input = {
            ":block/content": "test content",
            ":block/tags": ["Card", "Test"]
        };

        const result = LogseqPropertiesHelper.stripPropertyPrefixes(input);

        expect(result).toEqual({
            content: "test content",
            tags: ["Card", "Test"]
        });
    });

    it("should merge tags from user properties and block tags", () => {
        const input = {
            ":block/tags": ["Card", "Test"],
            ":user.property/tags-xyz": "a,b"
        };

        const result = LogseqPropertiesHelper.stripPropertyPrefixes(input);

        expect(result.tags).toEqual(["a", "b", "Card", "Test"]);
    });

    it("should handle properties without dash suffix", () => {
        const input = {
            ":user.property/customProp": "value"
        };

        const result = LogseqPropertiesHelper.stripPropertyPrefixes(input);

        expect(result).toEqual({
            customProp: "value"
        });
    });

    it("should transform full property object with merged tags", () => {
        const rawProperties = {
            ":logseq.property.embedding/hnsw-label-updated-at": 0,
            ":block/tags": ["Card", "Test"],
            ":plugin.property.rw1zys138/tags": "a,b",
            ":user.property/deck-bavZ5684": "Testx",
            ":user.property/extra-abc123": "Some extra value"
        };

        const result = LogseqPropertiesHelper.stripPropertyPrefixes(rawProperties);

        const expectedProperties = {
            "hnsw-label-updated-at": 0,
            "tags": ["a", "b", "Card", "Test"],
            "deck": "Testx",
            "extra": "Some extra value"
        };

        expect(result).toEqual(expectedProperties);
    });

    it("should handle object values without stringifying them in stripPropertyPrefixes", () => {
        const input = {
            ":user.property/metadata-xyz": { key: "value", nested: { data: 123 } },
            ":user.property/simple-abc": "text"
        };

        const result = LogseqPropertiesHelper.stripPropertyPrefixes(input);

        expect(result).toEqual({
            metadata: { key: "value", nested: { data: 123 } },
            simple: "text"
        });
    });

    it("should preserve array values that are not tags", () => {
        const input = {
            ":user.property/items-xyz": ["item1", "item2", "item3"]
        };

        const result = LogseqPropertiesHelper.stripPropertyPrefixes(input);

        expect(result).toEqual({
            items: ["item1", "item2", "item3"]
        });
    });

    it("should handle mixed property types including arrays and objects", () => {
        const input = {
            ":user.property/list-xyz": ["a", "b", "c"],
            ":user.property/obj-abc": { key: "value" },
            ":user.property/text-def": "simple"
        };

        const result = LogseqPropertiesHelper.stripPropertyPrefixes(input);

        expect(result).toEqual({
            list: ["a", "b", "c"],
            obj: { key: "value" },
            text: "simple"
        });
    });
});