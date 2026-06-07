import {describe, expect, test} from "vitest";
import {LogseqInMemoryDataPrinter} from "../../../../src/core/logseq-fakeable-transaction-tracker/LogseqInMemoryDataPrinter";
import type {InMemoryPageEntity} from "../../../../src/core/logseq-fakeable-transaction-tracker/types";

describe("LogseqInMemoryDataPrinter", () => {
    test("prints page properties in a new bullet and block properties inside the block bullet", () => {
        const page: InMemoryPageEntity = {
            uuid: "page-1",
            type: "page",
            name: "Test Page",
            title: "Test Page",
            fullTitle: "Test Page",
            content: "Test Page",
            format: "markdown",
            createdAt: 1,
            updatedAt: 1,
            "journal?": false,
            properties: {
                category: "notes",
                aliases: ["test-page"]
            },
            children: [
                {
                    uuid: "block-1",
                    type: "block",
                    content: "Block content line 1\nBlock content line 2",
                    title: "Block content line 1\nBlock content line 2",
                    fullTitle: "Block content line 1\nBlock content line 2",
                    format: "markdown",
                    createdAt: 1,
                    updatedAt: 1,
                    properties: {
                        tags: ["a", "b"],
                        metadata: {done: true},
                        priority: "A",
                        "template::internal": false,
                        logseqPropertyKey: "ignored"
                    },
                    children: []
                }
            ]
        };

        expect(LogseqInMemoryDataPrinter.print(new Map([[page.uuid, page]]))).toBe(
            [
                "* category:: notes",
                '  aliases:: ["test-page"]',
                '* tags:: ["a","b"]',
                '  metadata:: {"done":true}',
                "  priority:: A",
                "  template::internal:: false",
                "  logseqPropertyKey:: ignored",
                "  Block content line 1",
                "  Block content line 2"
            ].join("\n")
        );
    });
});
