import {
    configure,
    type Entry,
    type FileEntry,
    Uint8ArrayReader,
    Uint8ArrayWriter,
    ZipReader,
    ZipWriter
} from "@zip.js/zip.js/lib/zip-core-native.js";

const MAX_ENTRIES = 10_000;
const MAX_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 128 * 1024 * 1024;
const EPUB_MIMETYPE = "application/epub+zip";

// This entry point bundles a JS fallback without worker or WASM asset URLs.
configure({useWebWorkers: false, chunkSize: 1024});
const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Archive paths are canonical, relative, and never interpreted as host paths. */
export function validateArchivePath(path: string): void {
    const segments = path.replace(/\/$/, "").split("/");
    if (
        !path ||
        // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject control characters in untrusted ZIP paths.
        /[\\\x00-\x1f\x7f?#]/.test(path) ||
        /^[a-z][a-z\d+.-]*:/i.test(path) ||
        segments.some((segment) => !segment || segment === "." || segment === "..")
    ) {
        throw new Error(`Unsafe EPUB archive path: ${path}`);
    }
}

export class EpubArchive {
    private constructor(private readonly entries: Map<string, Uint8Array>) {}

    static async open(bytes: Uint8Array, abortSignal?: AbortSignal): Promise<EpubArchive> {
        abortSignal?.throwIfAborted();
        const reader = new ZipReader(new Uint8ArrayReader(bytes), {
            useWebWorkers: false,
            strictness: "strict",
            checkCrc32: true,
            checkOverlappingEntry: true
        });
        try {
            // zip.js 2.24 implements getData on directory records too, but omits it from their types.
            const files: (Entry & Pick<FileEntry, "getData">)[] = [];
            const names = new Set<string>();
            let declaredBytes = 0;
            for await (const file of reader.getEntriesGenerator()) {
                abortSignal?.throwIfAborted();
                if (names.size >= MAX_ENTRIES)
                    throw new Error("EPUB resource limit exceeded: too many entries.");
                validateArchivePath(file.filename);
                if (names.has(file.filename))
                    throw new Error(`Duplicate EPUB archive path: ${file.filename}`);
                if (file.encrypted || ![0, 8].includes(file.compressionMethod))
                    throw new Error("Encrypted or unsupported EPUB ZIP entry.");
                declaredBytes += file.uncompressedSize;
                if (
                    !Number.isSafeInteger(file.uncompressedSize) ||
                    file.uncompressedSize < 0 ||
                    file.uncompressedSize > MAX_ENTRY_BYTES ||
                    declaredBytes > MAX_EXPANDED_BYTES
                )
                    throw new Error("EPUB resource limit exceeded: expanded archive is too large.");
                names.add(file.filename);
                files.push(file as Entry & Pick<FileEntry, "getData">);
                if (files.length % 128 === 0) await yieldToEventLoop();
            }
            const entries = new Map<string, Uint8Array>();
            let expandedBytes = 0;
            let lastYield = performance.now();
            for (const file of files) {
                abortSignal?.throwIfAborted();
                const content = new Uint8Array(file.uncompressedSize);
                let written = 0;
                await file.getData(
                    new WritableStream<Uint8Array>({
                        async write(chunk) {
                            abortSignal?.throwIfAborted();
                            if (
                                written + chunk.length > content.length ||
                                written + chunk.length > MAX_ENTRY_BYTES ||
                                expandedBytes + chunk.length > MAX_EXPANDED_BYTES
                            )
                                throw new Error(
                                    "EPUB resource limit exceeded while decompressing entries."
                                );
                            content.set(chunk, written);
                            written += chunk.length;
                            expandedBytes += chunk.length;
                            if (performance.now() - lastYield >= 16) {
                                await yieldToEventLoop();
                                lastYield = performance.now();
                                abortSignal?.throwIfAborted();
                            }
                        }
                    }),
                    {signal: abortSignal}
                );
                if (written !== content.length) throw new Error("Invalid EPUB ZIP entry size.");
                entries.set(file.filename, content);
                await yieldToEventLoop();
            }
            abortSignal?.throwIfAborted();
            const archive = new EpubArchive(entries);
            if (
                new TextDecoder("utf-8", {ignoreBOM: true}).decode(archive.get("mimetype")) !==
                EPUB_MIMETYPE
            )
                throw new Error("The archive is not an EPUB (invalid mimetype).");
            return archive;
        } finally {
            // For this Uint8ArrayReader, close has no external resources to cancel.
            await reader.close();
        }
    }

    get(path: string): Uint8Array {
        const bytes = this.entries.get(path);
        if (!bytes) throw new Error(`Missing EPUB entry: ${path}`);
        return bytes;
    }

    /** Preserve resource paths and contents, replacing only the selected OPF. */
    async withPackage(
        packagePath: string,
        packageXml: string,
        abortSignal?: AbortSignal
    ): Promise<Uint8Array> {
        abortSignal?.throwIfAborted();
        validateArchivePath(packagePath);
        this.get(packagePath);
        const writer = new ZipWriter(new Uint8ArrayWriter(), {
            useWebWorkers: false,
            level: 0,
            zip64: false,
            dataDescriptor: false,
            extendedTimestamp: false,
            ntfsTimestamp: false,
            lastModDate: new Date(2000, 0, 1)
        });
        // Only completed bytes escape this method; failed in-memory writes own no external resources.
        await writer.add("mimetype", new Uint8ArrayReader(this.get("mimetype")), {
            signal: abortSignal
        });
        for (const [path, original] of this.entries) {
            if (path === "mimetype") continue;
            abortSignal?.throwIfAborted();
            const content = path === packagePath ? new TextEncoder().encode(packageXml) : original;
            await writer.add(path, new Uint8ArrayReader(content), {signal: abortSignal});
            await yieldToEventLoop();
        }
        const bytes = await writer.close();
        abortSignal?.throwIfAborted();
        return bytes;
    }
}
