import {
    type FileEntry,
    Uint8ArrayReader,
    Uint8ArrayWriter,
    ZipReader,
    ZipWriter
} from "@zip.js/zip.js/lib/zip-core-native.js";

export async function createEpub(
    options: {
        spine?: string;
        manifest?: string;
        packageXml?: string;
        entries?: Record<string, string | Uint8Array>;
        level?: number;
    } = {}
): Promise<Uint8Array> {
    const files: Record<string, string | Uint8Array> = {
        mimetype: "application/epub+zip",
        "META-INF/container.xml":
            '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
        "OPS/book.opf":
            options.packageXml ??
            `<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test publication</dc:title></metadata><manifest>${options.manifest ?? '<item id="one" href="text/first%20chapter.xhtml" media-type="application/xhtml+xml"/><item id="two" href="text/second.xhtml" media-type="application/xhtml+xml"/>'}</manifest><spine>${options.spine ?? '<itemref idref="two"/><itemref idref="one" linear="no"/>'}</spine></package>`,
        "OPS/text/first chapter.xhtml":
            '<html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="stylesheet" href="../style.css"/></head><body><h1>First chapter</h1><p>Alpha distinctive content.</p><img src="../image.png" alt="Sample"/></body></html>',
        "OPS/text/second.xhtml":
            '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Second chapter</h1><p>Beta distinctive content.</p></body></html>',
        "OPS/style.css": "p { font-weight: bold; }",
        "OPS/image.png": new Uint8Array([137, 80, 78, 71]),
        ...options.entries
    };
    return createZip(Object.entries(files), {level: options.level ?? 0});
}

export async function createZip(
    files: Iterable<readonly [string, string | Uint8Array]>,
    options: {level?: number; zip64?: boolean; dataDescriptor?: boolean} = {}
): Promise<Uint8Array> {
    const writer = new ZipWriter(new Uint8ArrayWriter(), {
        useWebWorkers: false,
        useCompressionStream: false,
        level: 0,
        dataDescriptor: false,
        extendedTimestamp: false,
        ntfsTimestamp: false,
        lastModDate: new Date(2000, 0, 1),
        ...options
    });
    for (const [path, content] of files)
        await writer.add(
            path,
            new Uint8ArrayReader(
                typeof content === "string" ? new TextEncoder().encode(content) : content
            )
        );
    return writer.close();
}

export async function readZip(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
    const reader = new ZipReader(new Uint8ArrayReader(bytes), {
        useWebWorkers: false,
        checkCrc32: true
    });
    try {
        const entries = Object.create(null);
        for await (const file of reader.getEntriesGenerator())
            entries[file.filename] = await (file as FileEntry).getData(new Uint8ArrayWriter());
        return entries;
    } finally {
        await reader.close();
    }
}

export async function collectPages<T>(pages: AsyncIterable<T>): Promise<T[]> {
    const result: T[] = [];
    for await (const page of pages) result.push(page);
    return result;
}
