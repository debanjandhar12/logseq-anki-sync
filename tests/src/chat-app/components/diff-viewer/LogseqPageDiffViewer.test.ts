import {FileIcon} from "lucide-react";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, test} from "vitest";
import {LogseqPageDiffViewer as DiffViewer} from "../../../../../src/chat-app/components/diff-viewer";

const files = {
    oldFile: {name: "page.md", content: "Before"},
    newFile: {name: "page.md", content: "After"}
};

describe("DiffViewer file icon", () => {
    test("retains the extension badge without a custom icon", () => {
        const markup = renderToStaticMarkup(createElement(DiffViewer, files));

        expect(markup).toContain('data-slot="diff-viewer-file-badge"');
        expect(markup).not.toContain('data-slot="diff-viewer-file-icon"');
    });

    test("suppresses custom icons and badges when icons are disabled", () => {
        const markup = renderToStaticMarkup(
            createElement(DiffViewer, {...files, fileIcon: FileIcon, showIcon: false})
        );

        expect(markup).not.toContain('data-slot="diff-viewer-file-icon"');
        expect(markup).not.toContain('data-slot="diff-viewer-file-badge"');
    });
});
