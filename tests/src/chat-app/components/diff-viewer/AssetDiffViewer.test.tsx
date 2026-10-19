import {act, createElement} from "react";
import {createRoot} from "react-dom/client";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, test} from "vitest";
import {AssetDiffViewer} from "../../../../../src/chat-app/components/diff-viewer";
import type {LogseqPrintedAssetChange} from "../../../../../src/core/logseq-reversible-transaction-tracker";

const image: LogseqPrintedAssetChange = {
    key: "asset",
    assetPath: "assets/test.png",
    status: "added",
    comparison: "different",
    before: {exists: false},
    after: {
        exists: true,
        byteLength: 3,
        sizeIsExact: true,
        preview: {kind: "image", mimeType: "image/png", contentBase64: "YWJj"}
    }
};

describe("AssetDiffViewer", () => {
    test("shows captured image sides and missing placeholder with a single header", () => {
        const markup = renderToStaticMarkup(createElement(AssetDiffViewer, {change: image}));
        expect(markup).toContain("data:image/png;base64,YWJj");
        expect(markup).toContain("Before");
        expect(markup).toContain("After");
        expect(markup).toContain("File did not exist");
        expect(markup.match(/data-slot="diff-viewer-header"/g)).toHaveLength(1);
    });
    test("shows oversize and unknown equality warnings", () => {
        const change: LogseqPrintedAssetChange = {
            ...image,
            comparison: "unknown",
            after: {
                exists: true,
                byteLength: 40 * 1024 ** 2,
                sizeIsExact: true,
                preview: {kind: "unavailable", reason: "too-large"}
            }
        };
        const markup = renderToStaticMarkup(createElement(AssetDiffViewer, {change}));
        expect(markup).toContain("32 MiB per-side limit");
        expect(markup).toContain("Content equality could not be checked");
        expect(markup).toContain("included when you approve");
    });
    test("renders empty text additions with explicit status", () => {
        const change: LogseqPrintedAssetChange = {
            ...image,
            after: {
                exists: true,
                byteLength: 0,
                sizeIsExact: true,
                preview: {kind: "text", content: ""}
            }
        };
        const markup = renderToStaticMarkup(createElement(AssetDiffViewer, {change}));
        expect(markup).toContain("added");
        expect(markup).toContain("assets/test.png");
    });
    test("falls back on decode error and supports header collapse", async () => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        const container = document.createElement("div");
        const root = createRoot(container);
        try {
            await act(async () => root.render(createElement(AssetDiffViewer, {change: image})));
            await act(async () =>
                container.querySelector("img")!.dispatchEvent(new Event("error"))
            );
            expect(container.textContent).toContain("could not be decoded");
            await act(async () => container.querySelector("button")!.click());
            expect(container.querySelector("button")!.getAttribute("aria-expanded")).toBe("false");
        } finally {
            await act(async () => root.unmount());
            globalThis.IS_REACT_ACT_ENVIRONMENT = false;
        }
    });
});
