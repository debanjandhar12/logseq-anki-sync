import type {MessageState} from "@assistant-ui/react";
import {describe, expect, test} from "vitest";
import {getMessageText, hasEditTextChanged} from "../../../../src/chat-app/components/EditComposer";

describe("hasEditTextChanged", () => {
    test("does not treat unchanged user message text as an edit", () => {
        expect(hasEditTextChanged("unchanged", "unchanged")).toBe(false);
    });

    test("detects changed user message text", () => {
        expect(hasEditTextChanged("updated", "original")).toBe(true);
    });

    test("continues comparing edits against the original message snapshot", () => {
        const originalMessageText = "original";

        expect(hasEditTextChanged("updated", originalMessageText)).toBe(true);
        expect(hasEditTextChanged("original", originalMessageText)).toBe(false);
    });

    test("matches assistant-ui's text extraction for messages with non-text and multiple text parts", () => {
        const content = [
            {type: "text", text: "first"},
            {type: "image", image: "data:image/png;base64,example"},
            {type: "text", text: "second"}
        ] as MessageState["content"];

        expect(getMessageText(content)).toBe("first\n\nsecond");
    });
});
