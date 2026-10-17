import {describe, expect, test} from "vitest";
import {EpubPageSplitter} from "../../../../../src/core/anydoc";
import {collectPages, createEpub, readZip} from "../fixtures/createEpub";

describe("EpubPageSplitter", () => {
    test("splits in spine order, including nonlinear documents, preserving resources", async () => {
        const pages = await collectPages(EpubPageSplitter.split(await createEpub()));
        expect(pages.map((page) => page.pageNo)).toEqual([1, 2]);
        for (const [index, page] of pages.entries()) {
            const entries = await readZip(page.bytes);
            const opf = new DOMParser().parseFromString(
                new TextDecoder().decode(entries["OPS/book.opf"]),
                "application/xml"
            );
            const references = opf.getElementsByTagNameNS("*", "itemref");
            expect(references).toHaveLength(1);
            expect(references[0].getAttribute("idref")).toBe(index === 0 ? "two" : "one");
            expect(new TextDecoder().decode(entries["OPS/style.css"])).toContain("font-weight");
            expect(entries["OPS/image.png"]).toEqual(new Uint8Array([137, 80, 78, 71]));
            expect(Object.keys(entries)[0]).toBe("mimetype");
            expect(new DataView(page.bytes.buffer).getUint16(8, true)).toBe(0);
            expect(new DataView(page.bytes.buffer).getUint16(28, true)).toBe(0);
            expect(new DataView(page.bytes.buffer).getUint16(6, true) & 8).toBe(0);
        }
    });

    test("deduplicates repeated content paths at their first position", async () => {
        const pages = await collectPages(
            EpubPageSplitter.split(
                await createEpub({
                    spine: '<itemref idref="two"/><itemref idref="two"/><itemref idref="one"/>'
                })
            )
        );
        expect(pages).toHaveLength(2);
    });

    test("preserves EPUB 2 package version and namespaced spine order", async () => {
        const packageXml = `<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="2.0"><opf:metadata/><opf:manifest><opf:item id="one" href="text/first%20chapter.xhtml" media-type="application/xhtml+xml"/></opf:manifest><opf:spine><opf:itemref idref="one"/></opf:spine></opf:package>`;
        const pages = await collectPages(EpubPageSplitter.split(await createEpub({packageXml})));
        expect(pages).toHaveLength(1);
        const entries = await readZip(pages[0].bytes);
        const opf = new DOMParser().parseFromString(
            new TextDecoder().decode(entries["OPS/book.opf"]),
            "application/xml"
        );
        expect(opf.documentElement.getAttribute("version")).toBe("2.0");
        expect(opf.getElementsByTagNameNS("*", "itemref")[0].getAttribute("idref")).toBe("one");
    });

    test("reads deflated entries and relative parent resource paths", async () => {
        const bytes = await createEpub({
            level: 6,
            manifest:
                '<item id="one" href="text/../text/first%20chapter.xhtml" media-type="application/xhtml+xml"/>',
            spine: '<itemref idref="one"/>'
        });
        expect(await collectPages(EpubPageSplitter.split(bytes))).toHaveLength(1);
    });

    test("rejects truncated archives", async () => {
        await expect(
            collectPages(EpubPageSplitter.split((await createEpub()).subarray(0, 100)))
        ).rejects.toThrow();
        await expect(collectPages(EpubPageSplitter.split(new Uint8Array()))).rejects.toThrow();
    });

    test.each([
        ["missing manifest reference", {spine: '<itemref idref="missing"/>'}],
        ["empty spine", {spine: ""}],
        [
            "missing chapter",
            {
                manifest:
                    '<item id="one" href="missing.xhtml" media-type="application/xhtml+xml"/>',
                spine: '<itemref idref="one"/>'
            }
        ],
        [
            "unsupported media type",
            {
                manifest: '<item id="one" href="image.png" media-type="image/png"/>',
                spine: '<itemref idref="one"/>'
            }
        ],
        [
            "traversal",
            {
                manifest:
                    '<item id="one" href="../../escape.xhtml" media-type="application/xhtml+xml"/>',
                spine: '<itemref idref="one"/>'
            }
        ],
        [
            "encoded separator",
            {
                manifest:
                    '<item id="one" href="text%2fsecond.xhtml" media-type="application/xhtml+xml"/>',
                spine: '<itemref idref="one"/>'
            }
        ],
        [
            "external URL",
            {
                manifest:
                    '<item id="one" href="https://example.test/ch.xhtml" media-type="application/xhtml+xml"/>',
                spine: '<itemref idref="one"/>'
            }
        ],
        ["malformed XML", {packageXml: "<package>"}],
        ["DTD", {packageXml: '<!DOCTYPE package [<!ENTITY x "bad">]><package/>'}],
        ["unsafe archive entry", {entries: {"../escape": "bad"}}],
        ["wrong mimetype", {entries: {mimetype: "application/zip"}}]
    ])("rejects %s", async (_, options) => {
        await expect(
            collectPages(EpubPageSplitter.split(await createEpub(options)))
        ).rejects.toThrow();
    });

    test("rejects corrupt checksums and encrypted archives before conversion", async () => {
        const encrypted = await createEpub();
        new DataView(encrypted.buffer).setUint16(6, 1, true);
        await expect(collectPages(EpubPageSplitter.split(encrypted))).rejects.toThrow();
        const corrupt = await createEpub();
        const header = new DataView(corrupt.buffer);
        corrupt[30 + header.getUint16(26, true) + header.getUint16(28, true)] ^= 1;
        await expect(collectPages(EpubPageSplitter.split(corrupt))).rejects.toThrow();
    });

    test("enforces declared entry budgets before decompression", async () => {
        const bytes = await createEpub();
        const view = new DataView(bytes.buffer);
        const directory = view.getUint32(bytes.length - 6, true);
        view.setUint32(directory + 24, 17 * 1024 * 1024, true);
        view.setUint32(view.getUint32(directory + 42, true) + 22, 17 * 1024 * 1024, true);
        await expect(collectPages(EpubPageSplitter.split(bytes))).rejects.toThrow("resource limit");
    });

    test("honors cancellation before splitting and between chapters", async () => {
        const controller = new AbortController();
        const bytes = await createEpub();
        const pages = EpubPageSplitter.split(bytes, controller.signal);
        expect((await pages.next()).done).toBe(false);
        controller.abort();
        await expect(pages.next()).rejects.toMatchObject({name: "AbortError"});
        await expect(
            collectPages(EpubPageSplitter.split(bytes, controller.signal))
        ).rejects.toMatchObject({name: "AbortError"});
    });
});
