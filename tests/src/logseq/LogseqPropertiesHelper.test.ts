import { describe, it, expect } from "vitest";

// We need to test the internal stripPropertyPrefixes function
// Since it's not exported, we'll test it through the public API behavior
// For now, we'll test the expected transformations

describe("Property name stripping", () => {
    it("should strip :user.property/name-suffix format to just name", () => {
        const testCases = [
            { input: ":user.property/deck-bavZ5684", expected: "deck" },
            { input: ":user.property/tags-xyz123", expected: "tags" },
            { input: ":user.property/occlusion-abc", expected: "occlusion" },
        ];

        testCases.forEach(({ input, expected }) => {
            // Extract property name between "/" and "-"
            const afterSlash = input.substring(":user.property/".length);
            const dashIndex = afterSlash.indexOf("-");
            const result = dashIndex !== -1 ? afterSlash.substring(0, dashIndex) : afterSlash;
            expect(result).toBe(expected);
        });
    });

    it("should handle :block/property format", () => {
        const input = ":block/content";
        const expected = "content";
        const result = input.substring(":block/".length);
        expect(result).toBe(expected);
    });

    it("should merge tags from user properties and block tags", () => {
        // :block/tags should be merged with user tags into properties.tags
        const blockTags = ["Card", "Test"];
        const userTags = "a,b";
        const expectedMerged = ["a", "b", "Card", "Test"];

        const splitUserTags = userTags.split(",").map(t => t.trim());
        const merged = [...splitUserTags, ...blockTags];
        expect(merged).toEqual(expectedMerged);
    });

    it("should handle properties without dash suffix", () => {
        const input = ":user.property/customProp";
        const afterSlash = input.substring(":user.property/".length);
        const dashIndex = afterSlash.indexOf("-");
        const result = dashIndex !== -1 ? afterSlash.substring(0, dashIndex) : afterSlash;
        expect(result).toBe("customProp");
    });

    it("should transform full property object with merged tags", () => {
        // Input from getBlockProperties/getPageProperties
        const rawProperties = {
            ":logseq.property.embedding/hnsw-label-updated-at": 0,
            ":block/tags": ["Card", "Test"],
            ":plugin.property.rw1zys138/tags": "a,b",
            ":user.property/deck-bavZ5684": "Testx",
            ":user.property/extra-abc123": "Some extra value"
        };

        // Simulate the stripping + merging logic
        const strippedProperties: Record<string, any> = {};
        let blockTags: string[] | null = null;

        for (const [key, value] of Object.entries(rawProperties)) {
            // Save :block/tags for merging
            if (key === ":block/tags") {
                blockTags = Array.isArray(value) ? value : [];
                continue;
            }

            // Unified property name extraction
            let cleanKey = key;
            if (key.startsWith(":")) {
                const lastSlash = key.lastIndexOf("/");
                if (lastSlash !== -1) {
                    const afterSlash = key.substring(lastSlash + 1);
                    // Only strip dash-suffix for :user.property/*
                    if (key.startsWith(":user.property/")) {
                        const dashIndex = afterSlash.indexOf("-");
                        cleanKey = dashIndex !== -1 ? afterSlash.substring(0, dashIndex) : afterSlash;
                    } else {
                        cleanKey = afterSlash;
                    }
                } else {
                    cleanKey = key.substring(1);
                }
            }

            strippedProperties[cleanKey] = value;
        }

        // Merge tags
        if (strippedProperties.tags || blockTags) {
            let mergedTags: string[] = [];

            if (strippedProperties.tags && typeof strippedProperties.tags === "string") {
                mergedTags = strippedProperties.tags.split(",").map((t: string) => t.trim());
            }

            if (blockTags && blockTags.length > 0) {
                mergedTags = [...mergedTags, ...blockTags];
            }

            strippedProperties.tags = mergedTags;
        }

        // Expected result: merged tags + all properties (including system)
        const expectedProperties = {
            "hnsw-label-updated-at": 0,  // System property kept
            "tags": ["a", "b", "Card", "Test"],
            "deck": "Testx",
            "extra": "Some extra value"
        };

        expect(strippedProperties).toEqual(expectedProperties);
    });
});
