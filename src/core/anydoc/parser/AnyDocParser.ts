import initializeAnyDoc, {toMarkdownBytes} from "@firecrawl/anydoc-wasm";
import anyDocWasmUrl from "@firecrawl/anydoc-wasm/anydoc_wasm_bg.wasm?url";

export class AnyDocParser {
    private static initializationPromise: Promise<void> | null = null;

    private constructor() {}

    static async parsePdfPage(pdfBytes: Uint8Array): Promise<string> {
        await AnyDocParser.initialize();
        return toMarkdownBytes(pdfBytes, "pdf");
    }

    static async parseEpubPage(epubBytes: Uint8Array): Promise<string> {
        await AnyDocParser.initialize();
        return toMarkdownBytes(epubBytes, "epub");
    }

    private static async initialize(): Promise<void> {
        if (AnyDocParser.initializationPromise === null) {
            AnyDocParser.initializationPromise = AnyDocParser.loadWasm().catch((error) => {
                AnyDocParser.initializationPromise = null;
                throw new AnyDocInitializationError("Unable to initialize AnyDoc WASM.", {
                    cause: error
                });
            });
        }
        await AnyDocParser.initializationPromise;
    }

    private static async loadWasm(): Promise<void> {
        const response = await fetch(anyDocWasmUrl);
        if (!response.ok) {
            throw new Error(`Unable to load AnyDoc WASM (status ${response.status}).`);
        }
        await initializeAnyDoc({module_or_path: await response.arrayBuffer()});
    }
}

/** Infrastructure failures must not be cached as document conversion failures. */
export class AnyDocInitializationError extends Error {}
