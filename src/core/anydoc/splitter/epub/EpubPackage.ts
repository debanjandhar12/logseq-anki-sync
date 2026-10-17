import {type EpubArchive, validateArchivePath} from "./EpubArchive";

function parseXml(bytes: Uint8Array, path: string): XMLDocument {
    const xml = new TextDecoder().decode(bytes);
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml))
        throw new Error(`Unsafe EPUB XML declarations in ${path}.`);
    const document = new DOMParser().parseFromString(xml, "application/xml");
    if (document.getElementsByTagNameNS("*", "parsererror").length)
        throw new Error(`Malformed EPUB XML: ${path}`);
    return document;
}

function elements(parent: Document | Element, name: string): Element[] {
    return Array.from(parent.getElementsByTagNameNS("*", name));
}

function resolveEntry(packagePath: string, href: string): string {
    if (!href || /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("/"))
        throw new Error(`Unsafe EPUB resource reference: ${href}`);
    const path = href.split("#", 1)[0];
    const segments = packagePath.split("/").slice(0, -1);
    for (const encoded of path.split("/")) {
        const segment = decodeURIComponent(encoded);
        if (segment === ".") continue;
        if (segment === "..") {
            if (!segments.length) throw new Error(`EPUB resource escapes archive: ${href}`);
            segments.pop();
        } else {
            // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject decoded control characters in untrusted resource references.
            if (!segment || /[/\\?#\x00-\x1f\x7f]/.test(segment))
                throw new Error(`Ambiguous EPUB resource reference: ${href}`);
            segments.push(segment);
        }
    }
    const resolved = segments.join("/");
    validateArchivePath(resolved);
    return resolved;
}

export class EpubPackage {
    private constructor(
        readonly path: string,
        private readonly document: XMLDocument,
        private readonly spineIndices: number[]
    ) {}

    static read(archive: EpubArchive): EpubPackage {
        const container = parseXml(archive.get("META-INF/container.xml"), "META-INF/container.xml");
        const rootfiles = elements(container, "rootfile");
        const rootfile =
            rootfiles.find(
                (element) => element.getAttribute("media-type") === "application/oebps-package+xml"
            ) ?? rootfiles[0];
        const path = rootfile?.getAttribute("full-path");
        if (!path) throw new Error("Missing EPUB package rootfile.");
        validateArchivePath(path);
        const document = parseXml(archive.get(path), path);
        if (document.documentElement.localName !== "package")
            throw new Error("Invalid EPUB package root element.");
        const manifest = elements(document, "manifest");
        const spines = elements(document, "spine");
        if (manifest.length !== 1 || spines.length !== 1)
            throw new Error("EPUB must contain one manifest and spine.");
        const items = new Map<string, Element>();
        for (const item of Array.from(manifest[0].children)) {
            if (item.localName !== "item") continue;
            const id = item.getAttribute("id");
            if (!id || items.has(id)) throw new Error("Missing or duplicate EPUB manifest ID.");
            items.set(id, item);
        }
        const seen = new Set<string>();
        const spineIndices: number[] = [];
        const references = Array.from(spines[0].children);
        references.forEach((reference, index) => {
            if (reference.localName !== "itemref") return;
            const item = items.get(reference.getAttribute("idref"));
            if (!item) throw new Error("Missing EPUB spine manifest reference.");
            if (!["application/xhtml+xml", "text/html"].includes(item.getAttribute("media-type")))
                throw new Error("Unsupported EPUB spine content type.");
            const entry = resolveEntry(path, item.getAttribute("href"));
            archive.get(entry);
            if (!seen.has(entry)) {
                seen.add(entry);
                spineIndices.push(index);
            }
        });
        if (!spineIndices.length) throw new Error("The EPUB contains no readable spine documents.");
        return new EpubPackage(path, document, spineIndices);
    }

    get pageCount(): number {
        return this.spineIndices.length;
    }

    selectPage(index: number): string {
        const document = this.document.cloneNode(true) as XMLDocument;
        const spine = elements(document, "spine")[0];
        Array.from(spine.children).forEach((reference, referenceIndex) => {
            if (referenceIndex !== this.spineIndices[index]) reference.remove();
        });
        return new XMLSerializer().serializeToString(document);
    }
}
