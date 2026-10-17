import {describe, expect, test} from "vitest";
import {getDocumentFormat} from "../../../../../src/core/anydoc";

describe("getDocumentFormat", () => {
    test.each([
        ["../assets/book.PDF?download=1#page=2", "pdf"],
        [" ../assets/book.EPUB#chapter ", "epub"],
        ["../assets/book.pdf.txt", undefined],
        ["../assets/book.txt?name=book.pdf", undefined],
        ["", undefined]
    ])("detects %s", (path, expected) => expect(getDocumentFormat(path)).toBe(expected));
});
