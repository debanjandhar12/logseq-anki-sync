import {describe, expect, test, vi} from "vitest";
import {
    EpubArchive,
    validateArchivePath
} from "../../../../../../src/core/anydoc/splitter/epub/EpubArchive";
import {createEpub, createZip, readZip} from "../../fixtures/createEpub";

/** Locate central/local headers without depending on writer-specific extra fields. */
function headers(bytes: Uint8Array) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = view.getUint32(bytes.length - 6, true);
    const result: {central: number; local: number; data: number}[] = [];
    while (view.getUint32(offset, true) === 0x02014b50) {
        const local = view.getUint32(offset + 42, true);
        result.push({
            central: offset,
            local,
            data: local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
        });
        offset +=
            46 +
            view.getUint16(offset + 28, true) +
            view.getUint16(offset + 30, true) +
            view.getUint16(offset + 32, true);
    }
    return {view, entries: result};
}

describe("EpubArchive", () => {
    test("reads an independently generated Python zipfile fixture", async () => {
        // Python 3 zipfile: stored mimetype plus deflated chapter, timestamp 2000-01-01.
        // Keeps cross-implementation coverage without a second ZIP dependency.
        const base64 =
            "UEsDBBQAAAAAAAAAIShvYassFAAAABQAAAAIAAAAbWltZXR5cGVhcHBsaWNhdGlvbi9lcHViK3ppcFBLAwQUAAAACAAAACEo3OlWehsAAAAcAAAABwAAAGNoYXB0ZXLLzEtJLUgFEnklCimpaTmJJakpCsn5eSVAAQBQSwECFAMUAAAAAAAAACEob2GrLBQAAAAUAAAACAAAAAAAAAAAAAAAgAEAAAAAbWltZXR5cGVQSwECFAMUAAAACAAAACEo3OlWehsAAAAcAAAABwAAAAAAAAAAAAAAgAE6AAAAY2hhcHRlclBLBQYAAAAAAgACAGsAAAB6AAAAAAA=";
        const archive = await EpubArchive.open(
            Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
        );
        expect(new TextDecoder().decode(archive.get("chapter"))).toBe(
            "independent deflated content"
        );
    });

    test("preserves resources, empty files and directory records without mutating the source", async () => {
        const bytes = await createEpub({
            entries: {
                "OPS/empty/": new Uint8Array(),
                "OPS/empty/file": "",
                "OPS/日本語.txt": "内容"
            }
        });
        const archive = await EpubArchive.open(bytes);
        const original = archive.get("OPS/book.opf").slice();
        for (const replacement of ["<package/>", "<package version='2.0'/>"]) {
            const output = await readZip(await archive.withPackage("OPS/book.opf", replacement));
            const input = await readZip(bytes);
            expect(Object.keys(output)).toEqual(Object.keys(input));
            for (const [path, content] of Object.entries(input))
                expect(Array.from(output[path])).toEqual(
                    Array.from(
                        path === "OPS/book.opf" ? new TextEncoder().encode(replacement) : content
                    )
                );
        }
        expect(archive.get("OPS/book.opf")).toEqual(original);
        await expect(archive.withPackage("missing.opf", "<package/>")).rejects.toThrow(
            "Missing EPUB entry"
        );
    });

    test.each([false, true])("reads dataDescriptor=%s", async (dataDescriptor) => {
        const bytes = await createZip(
            [
                ["mimetype", "application/epub+zip"],
                ["chapter", "content"]
            ],
            {level: 6, dataDescriptor}
        );
        expect(new TextDecoder().decode((await EpubArchive.open(bytes)).get("chapter"))).toBe(
            "content"
        );
    });

    test("accepts small ZIP64 input and emits ordinary ZIP output", async () => {
        const bytes = await createZip(
            [
                ["mimetype", "application/epub+zip"],
                ["book.opf", "<package/>"]
            ],
            {zip64: true}
        );
        const archive = await EpubArchive.open(bytes);
        const output = await archive.withPackage("book.opf", "<package/>");
        const view = new DataView(output.buffer);
        expect(view.getUint16(output.length - 12, true)).toBe(2);
        expect(new TextDecoder().decode((await EpubArchive.open(output)).get("book.opf"))).toBe(
            "<package/>"
        );
    });

    test("accepts zeroed local CRC and sizes while verifying actual content", async () => {
        const bytes = await createEpub();
        const {view, entries} = headers(bytes);
        for (const {local} of entries) {
            view.setUint32(local + 14, 0, true);
            view.setUint32(local + 18, 0, true);
            view.setUint32(local + 22, 0, true);
        }
        await expect(EpubArchive.open(bytes)).resolves.toBeInstanceOf(EpubArchive);
        bytes[entries[1].data] ^= 1;
        await expect(EpubArchive.open(bytes)).rejects.toThrow();
    });

    test("decodes legacy filenames before validating and preserving them", async () => {
        const bytes = await createZip([
            ["mimetype", "application/epub+zip"],
            ["a", "legacy"]
        ]);
        const {view, entries} = headers(bytes);
        const {local, central} = entries[1];
        view.setUint16(local + 6, view.getUint16(local + 6, true) & ~0x800, true);
        view.setUint16(central + 8, view.getUint16(central + 8, true) & ~0x800, true);
        bytes[local + 30] = 0x82; // CP437 é, invalid as a standalone UTF-8 byte.
        bytes[central + 46] = 0x82;
        const archive = await EpubArchive.open(bytes);
        expect(new TextDecoder().decode(archive.get("é"))).toBe("legacy");
    });

    test("accepts an entry at the 16 MiB expanded limit", async () => {
        const content = new Uint8Array(16 * 1024 * 1024);
        const bytes = await createZip(
            [
                ["mimetype", "application/epub+zip"],
                ["limit", content]
            ],
            {level: 6}
        );
        expect((await EpubArchive.open(bytes)).get("limit").length).toBe(content.length);
    });

    test.each([
        "../escape",
        "/absolute",
        "a\\b",
        "a?b",
        "a#b",
        "https:book",
        "a\0b",
        "a//b",
        "a/./b"
    ])("rejects unsafe path %j", (path) => {
        expect(() => validateArchivePath(path)).toThrow("Unsafe EPUB archive path");
    });

    test("rejects duplicate decoded names before extraction", async () => {
        const bytes = await createZip([
            ["mimetype", "application/epub+zip"],
            ["aa", "a"],
            ["bb", "b"]
        ]);
        const {entries} = headers(bytes);
        bytes.set(new TextEncoder().encode("aa"), entries[2].local + 30);
        bytes.set(new TextEncoder().encode("aa"), entries[2].central + 46);
        await expect(EpubArchive.open(bytes)).rejects.toThrow(/Duplicate|ambiguous/i);
    });

    test.each(["encrypted", "unsupported compression"])("rejects %s entries", async (kind) => {
        const bytes = await createEpub();
        const {view, entries} = headers(bytes);
        const {local, central} = entries[1];
        if (kind === "encrypted") {
            view.setUint16(local + 6, view.getUint16(local + 6, true) | 1, true);
            view.setUint16(central + 8, view.getUint16(central + 8, true) | 1, true);
        } else {
            view.setUint16(local + 8, 12, true);
            view.setUint16(central + 10, 12, true);
        }
        await expect(EpubArchive.open(bytes)).rejects.toThrow("Encrypted or unsupported");
    });

    test("rejects more than 10,000 entries before allocating extraction buffers", async () => {
        const bytes = await createZip(
            Array.from({length: 10_001}, (_, index) => [`entry-${index}`, ""] as const)
        );
        await expect(EpubArchive.open(bytes)).rejects.toThrow("too many entries");
    }, 20_000);

    test("enforces cumulative declared expansion before extraction", async () => {
        const bytes = await createZip(
            Array.from({length: 9}, (_, index) => [`entry-${index}`, ""] as const)
        );
        const {view, entries} = headers(bytes);
        for (const {local, central} of entries) {
            view.setUint32(local + 22, 16 * 1024 * 1024, true);
            view.setUint32(central + 24, 16 * 1024 * 1024, true);
        }
        await expect(EpubArchive.open(bytes)).rejects.toThrow("resource limit");
    });

    test("rejects dishonest expanded sizes during deflate extraction", async () => {
        const bytes = await createZip(
            [
                ["mimetype", "application/epub+zip"],
                ["bomb", new Uint8Array(1024 * 1024)]
            ],
            {level: 6}
        );
        const {view, entries} = headers(bytes);
        view.setUint32(entries[1].local + 22, 1, true);
        view.setUint32(entries[1].central + 24, 1, true);
        await expect(EpubArchive.open(bytes)).rejects.toThrow();
    });

    test("rejects inconsistent local headers and overlapping listed data", async () => {
        const bytes = await createEpub();
        const {view, entries} = headers(bytes);
        // Extend the first stored record into the second record's local header.
        const size = entries[1].data - entries[0].data + 1;
        view.setUint32(entries[0].local + 18, size, true);
        view.setUint32(entries[0].local + 22, size, true);
        view.setUint32(entries[0].central + 20, size, true);
        view.setUint32(entries[0].central + 24, size, true);
        // Avoid failing CRC on the extended first entry before the second overlap is inspected.
        const checksumArchive = await createZip([
            ["content", bytes.subarray(entries[0].data, entries[0].data + size)]
        ]);
        const checksumHeaders = headers(checksumArchive);
        const checksum = checksumHeaders.view.getUint32(
            checksumHeaders.entries[0].central + 16,
            true
        );
        view.setUint32(entries[0].local + 14, checksum, true);
        view.setUint32(entries[0].central + 16, checksum, true);
        await expect(EpubArchive.open(bytes)).rejects.toThrow(/overlap/i);
    });

    test("honors timer cancellation during enumeration", async () => {
        const bytes = await createZip(
            Array.from({length: 256}, (_, index) => [`entry-${index}`, ""] as const)
        );
        const controller = new AbortController();
        const opening = EpubArchive.open(bytes, controller.signal);
        setTimeout(() => controller.abort(), 0);
        await expect(opening).rejects.toMatchObject({name: "AbortError"});
    });

    test("honors timer cancellation during extraction and repackaging", async () => {
        const bytes = await createEpub();
        const extraction = new AbortController();
        const opening = EpubArchive.open(bytes, extraction.signal);
        setTimeout(() => extraction.abort(), 0);
        await expect(opening).rejects.toMatchObject({name: "AbortError"});
        const archive = await EpubArchive.open(bytes);
        const writing = new AbortController();
        const output = archive.withPackage("OPS/book.opf", "<package/>", writing.signal);
        setTimeout(() => writing.abort(), 0);
        await expect(output).rejects.toMatchObject({name: "AbortError"});
        await expect(archive.withPackage("OPS/book.opf", "<package/>")).resolves.toBeInstanceOf(
            Uint8Array
        );
    });

    test("checks declared budgets before creating a writable extraction stream", async () => {
        const bytes = await createEpub();
        const {view, entries} = headers(bytes);
        view.setUint32(entries[0].central + 24, 17 * 1024 * 1024, true);
        const stream = vi.spyOn(globalThis, "WritableStream");
        try {
            await expect(EpubArchive.open(bytes)).rejects.toThrow("resource limit");
            expect(stream).not.toHaveBeenCalled();
        } finally {
            stream.mockRestore();
        }
    });
});
