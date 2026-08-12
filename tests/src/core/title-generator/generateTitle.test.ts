import type {ThreadMessage} from "@assistant-ui/react";
import {describe, expect, test} from "vitest";
import {generateTitle} from "../../../../src/core/title-generator/generateTitle";

/**
 * Helper to create a minimal ThreadMessage[] with a single user text message.
 */
const makeMessages = (text: string): ThreadMessage[] => [
    {
        id: "msg-1",
        role: "user",
        createdAt: new Date(),
        content: [{type: "text", text}],
        attachments: [],
        metadata: undefined as never
    }
];

describe("generateTitle", () => {
    const FALLBACK_ID = "thread-abc-123";

    // --- Fallback ---

    test("returns remoteId when messages are empty", () => {
        expect(generateTitle(FALLBACK_ID, [])).toBe(FALLBACK_ID);
    });

    test("returns remoteId when message has no text part", () => {
        const msgs: ThreadMessage[] = [
            {
                id: "msg-1",
                role: "user",
                createdAt: new Date(),
                content: [],
                attachments: [],
                metadata: undefined as never
            }
        ];
        expect(generateTitle(FALLBACK_ID, msgs)).toBe(FALLBACK_ID);
    });

    // --- Strategy 1: Custom vocab domain terms ---

    test("extracts vocab terms: 'logseq query is good'", () => {
        const title = generateTitle(FALLBACK_ID, makeMessages("logseq query is good"));
        expect(title).not.toBe(FALLBACK_ID);
        expect(title.toLowerCase()).toContain("logseq");
        expect(title.toLowerCase()).toContain("query");
    });

    test("extracts vocab terms: 'how do I sync my graph with git?'", () => {
        const title = generateTitle(FALLBACK_ID, makeMessages("how do I sync my graph with git?"));
        expect(title).not.toBe(FALLBACK_ID);
        expect(title.toLowerCase()).toContain("sync");
        expect(title.toLowerCase()).toContain("graph");
        expect(title.toLowerCase()).toContain("git");
    });

    test("extracts vocab terms: 'can you explain flashcards in logseq?'", () => {
        const title = generateTitle(
            FALLBACK_ID,
            makeMessages("can you explain flashcards in logseq?")
        );
        expect(title).not.toBe(FALLBACK_ID);
        expect(title.toLowerCase()).toContain("flashcards");
        expect(title.toLowerCase()).toContain("logseq");
    });

    test("extracts single vocab term: 'fix the sidebar'", () => {
        const title = generateTitle(FALLBACK_ID, makeMessages("fix the sidebar"));
        expect(title).not.toBe(FALLBACK_ID);
        expect(title.toLowerCase()).toContain("sidebar");
    });

    test("extracts vocab term case-insensitively: 'Tell me about Anki'", () => {
        const title = generateTitle(FALLBACK_ID, makeMessages("Tell me about Anki"));
        expect(title).not.toBe(FALLBACK_ID);
        expect(title.toLowerCase()).toContain("anki");
    });

    // --- Strategy 2/3: Noun / content-word fallback for non-domain text ---

    test("falls back to nouns or content words for generic text", () => {
        const title = generateTitle(
            FALLBACK_ID,
            makeMessages("what is the best way to take notes?")
        );
        expect(title).not.toBe(FALLBACK_ID);
    });

    test("falls back to nouns for non-vocab proper nouns", () => {
        const title = generateTitle(FALLBACK_ID, makeMessages("Tell me about Paris"));
        expect(title).not.toBe(FALLBACK_ID);
    });

    // --- Quality constraints ---

    test("title is shorter than the original message", () => {
        const longMessage =
            "I have been trying to set up advanced queries in Logseq but the datalog syntax is really confusing and I keep getting errors when I try to filter by page properties";
        const title = generateTitle(FALLBACK_ID, makeMessages(longMessage));
        expect(title).not.toBe(FALLBACK_ID);
        expect(title.length).toBeLessThan(longMessage.length);
    });

    test("title does not exceed MAX_TITLE_LENGTH (50 chars)", () => {
        const longMessage =
            "I have been trying to set up advanced queries in Logseq but the datalog syntax is really confusing and I keep getting errors when I try to filter by page properties";
        const title = generateTitle(FALLBACK_ID, makeMessages(longMessage));
        expect(title.length).toBeLessThanOrEqual(50);
    });

    test("title has no trailing punctuation", () => {
        const title = generateTitle(FALLBACK_ID, makeMessages("what about the encryption?"));
        expect(title).not.toMatch(/[?!.,;:]$/);
    });

    test("title starts with an uppercase letter", () => {
        const title = generateTitle(FALLBACK_ID, makeMessages("logseq query is good"));
        expect(title[0]).toBe(title[0].toUpperCase());
    });
});
