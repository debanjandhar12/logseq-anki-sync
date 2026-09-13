import {FileTextIcon, ImageIcon} from "lucide-react";
import {describe, expect, test} from "vitest";
import {getLogseqAttachmentIcon} from "../../../../src/chat-app/utils/getLogseqAttachmentIcon";

describe("getLogseqAttachmentIcon", () => {
    test.each([
        ["image", ImageIcon],
        ["logseq-pdf", FileTextIcon]
    ])("maps %s to its icon", (type, expectedIcon) => {
        expect(getLogseqAttachmentIcon(type)).toBe(expectedIcon);
    });

    test.each([
        undefined,
        null,
        "document",
        "file",
        "unknown"
    ])("returns null for unsupported type %s", (type) => {
        expect(getLogseqAttachmentIcon(type)).toBeNull();
    });
});
