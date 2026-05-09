import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {describe, expect, it} from "vitest";
import {LogseqPropertiesHelper} from "../../../src/logseq/LogseqPropertiesHelper";

describe("LogseqPropertiesHelper.addStripedPropertyPrefixes", () => {
    it("should strip :user.property/name-suffix format to just name (inclusive - keeps original keys)", () => {
        const input = {
            ":user.property/deck-bavZ5684": "test-deck",
            ":user.property/tags-xyz123": "a,b",
            ":user.property/occlusion-abc": "true"
        };

        const result = LogseqPropertiesHelper.addStripedPropertyPrefixes(input);

        expect(result).toEqual({
            ":user.property/deck-bavZ5684": "test-deck",
            ":user.property/tags-xyz123": "a,b",
            ":user.property/occlusion-abc": "true",
            deck: "test-deck",
            tags: "a,b",
            occlusion: "true"
        });
    });

    it("should skip :block/tags", () => {
        const input = {
            ":block/content": "test content",
            ":block/tags": ["Card", "Test"]
        };

        const result = LogseqPropertiesHelper.addStripedPropertyPrefixes(input);

        expect(result).toEqual({
            ":block/content": "test content",
            ":block/tags": ["Card", "Test"],
            content: "test content"
        });
    });

    it("should handle properties without dash suffix (inclusive - keeps original keys)", () => {
        const input = {
            ":user.property/customProp": "value"
        };

        const result = LogseqPropertiesHelper.addStripedPropertyPrefixes(input);

        expect(result).toEqual({
            ":user.property/customProp": "value",
            customProp: "value"
        });
    });

    it("should transform full property object (inclusive - keeps original keys, skips :block/tags)", () => {
        const rawProperties = {
            ":logseq.property.embedding/hnsw-label-updated-at": 0,
            ":block/tags": ["Card", "Test"],
            ":plugin.property.rw1zys138/tags": "a,b",
            ":user.property/deck-bavZ5684": "Testx",
            ":user.property/extra-abc123": "Some extra value"
        };

        const result = LogseqPropertiesHelper.addStripedPropertyPrefixes(rawProperties);

        expect(result).toEqual({
            ":logseq.property.embedding/hnsw-label-updated-at": 0,
            ":block/tags": ["Card", "Test"],
            ":plugin.property.rw1zys138/tags": "a,b",
            ":user.property/deck-bavZ5684": "Testx",
            ":user.property/extra-abc123": "Some extra value",
            "hnsw-label-updated-at": 0,
            tags: "a,b",
            deck: "Testx",
            extra: "Some extra value"
        });
    });

    it("should handle object values without stringifying them (inclusive - keeps original keys)", () => {
        const input = {
            ":user.property/metadata-xyz": {key: "value", nested: {data: 123}},
            ":user.property/simple-abc": "text"
        };

        const result = LogseqPropertiesHelper.addStripedPropertyPrefixes(input);

        expect(result).toEqual({
            ":user.property/metadata-xyz": {key: "value", nested: {data: 123}},
            ":user.property/simple-abc": "text",
            metadata: {key: "value", nested: {data: 123}},
            simple: "text"
        });
    });

    it("should preserve array values that are not tags (inclusive - keeps original keys)", () => {
        const input = {
            ":user.property/items-xyz": ["item1", "item2", "item3"]
        };

        const result = LogseqPropertiesHelper.addStripedPropertyPrefixes(input);

        expect(result).toEqual({
            ":user.property/items-xyz": ["item1", "item2", "item3"],
            items: ["item1", "item2", "item3"]
        });
    });

    it("should handle mixed property types including arrays and objects (inclusive - keeps original keys)", () => {
        const input = {
            ":user.property/list-xyz": ["a", "b", "c"],
            ":user.property/obj-abc": {key: "value"},
            ":user.property/text-def": "simple"
        };

        const result = LogseqPropertiesHelper.addStripedPropertyPrefixes(input);

        expect(result).toEqual({
            ":user.property/list-xyz": ["a", "b", "c"],
            ":user.property/obj-abc": {key: "value"},
            ":user.property/text-def": "simple",
            list: ["a", "b", "c"],
            obj: {key: "value"},
            text: "simple"
        });
    });
});

describe("LogseqPropertiesHelper.handleTagProperty", () => {
    const createMockEntity = (tags?: Array<{id: number; name: string}>): BlockEntity => {
        return {
            uuid: "test-uuid",
            tags: tags
        } as unknown as BlockEntity;
    };

    it("should merge tags from user properties and block tags", () => {
        const entity = createMockEntity([
            {id: 1, name: "Card"},
            {id: 2, name: "Test"}
        ]);
        const input = {
            ":block/tags": ["Card", "Test"],
            tags: "a,b"
        };

        const result = LogseqPropertiesHelper.handleTagProperty(entity, input);

        expect(result.tags).toEqual(["a", "b", "Card", "Test"]);
        expect(result[":block/tags"]).toBeUndefined();
        expect(result.tagIds).toEqual([1, 2]);
    });

    it("should handle block tags only", () => {
        const entity = createMockEntity([
            {id: 1, name: "Card"},
            {id: 2, name: "Test"}
        ]);
        const input = {
            ":block/tags": ["Card", "Test"]
        };

        const result = LogseqPropertiesHelper.handleTagProperty(entity, input);

        expect(result.tags).toEqual(["Card", "Test"]);
        expect(result[":block/tags"]).toBeUndefined();
        expect(result.tagIds).toEqual([1, 2]);
    });

    it("should handle user tags only (string)", () => {
        const entity = createMockEntity(); // No entity tags
        const input = {
            tags: "a,b,c"
        };

        const result = LogseqPropertiesHelper.handleTagProperty(entity, input);

        expect(result.tags).toEqual(["a", "b", "c"]);
        expect(result.tagIds).toEqual([]);
    });

    it("should handle user tags only (array)", () => {
        const entity = createMockEntity(); // No entity tags
        const input = {
            tags: ["a", "b", "c"]
        };

        const result = LogseqPropertiesHelper.handleTagProperty(entity, input);

        expect(result.tags).toEqual(["a", "b", "c"]);
        expect(result.tagIds).toEqual([]);
    });

    it("should return null for null input", () => {
        const entity = createMockEntity();
        const result = LogseqPropertiesHelper.handleTagProperty(entity, null as any);
        expect(result).toBeNull();
    });

    it("should handle empty block tags array with user tags", () => {
        const entity = createMockEntity(); // No entity tags
        const input = {
            ":block/tags": [],
            tags: "a,b"
        };

        const result = LogseqPropertiesHelper.handleTagProperty(entity, input);

        expect(result.tags).toEqual(["a", "b"]);
        expect(result[":block/tags"]).toBeUndefined();
        expect(result.tagIds).toEqual([]);
    });

    it("should handle entity without tags property but with block tags in properties", () => {
        const entity = {uuid: "test-uuid"} as unknown as BlockEntity;
        const input = {
            ":block/tags": ["Card"],
            tags: "a,b"
        };

        const result = LogseqPropertiesHelper.handleTagProperty(entity, input);

        expect(result.tags).toEqual(["a", "b", "Card"]);
        expect(result.tagIds).toEqual([]);
    });
});

describe("LogseqPropertiesHelper.addStripedPropertyPrefixes + handleTagProperty integration", () => {
    const createMockEntity = (tags?: Array<{id: number; name: string}>): BlockEntity => {
        return {
            uuid: "test-uuid",
            tags: tags
        } as unknown as BlockEntity;
    };

    it("should add stripped prefixes first, then handle tags", () => {
        const entity = createMockEntity([
            {id: 1, name: "Card"},
            {id: 2, name: "Test"}
        ]);
        const rawProperties = {
            ":block/tags": ["Card", "Test"],
            ":user.property/tags-xyz": "a,b"
        };

        const stripped = LogseqPropertiesHelper.addStripedPropertyPrefixes(rawProperties);
        // handleTagProperty then merges :block/tags with tags
        const result = LogseqPropertiesHelper.handleTagProperty(entity, stripped);

        expect(result.tags).toEqual(["a", "b", "Card", "Test"]);
        expect(result[":block/tags"]).toBeUndefined();
        expect(result.tagIds).toEqual([1, 2]);
    });

    it("should handle full property object", () => {
        const entity = createMockEntity([
            {id: 1, name: "Card"},
            {id: 2, name: "Test"}
        ]);
        const rawProperties = {
            ":logseq.property.embedding/hnsw-label-updated-at": 0,
            ":block/tags": ["Card", "Test"],
            ":plugin.property.rw1zys138/tags": "a,b",
            ":user.property/deck-bavZ5684": "Testx",
            ":user.property/extra-abc123": "Some extra value"
        };

        const stripped = LogseqPropertiesHelper.addStripedPropertyPrefixes(rawProperties);
        const result = LogseqPropertiesHelper.handleTagProperty(entity, stripped);

        expect(result["hnsw-label-updated-at"]).toBe(0);
        expect(result.tags).toEqual(["a", "b", "Card", "Test"]);
        expect(result.deck).toBe("Testx");
        expect(result.extra).toBe("Some extra value");
        expect(result.tagIds).toEqual([1, 2]);
    });
});
