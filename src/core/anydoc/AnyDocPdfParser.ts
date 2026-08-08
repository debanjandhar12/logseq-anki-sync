import initializeAnyDoc, {toMarkdownBytes} from "@firecrawl/anydoc-wasm";
import anyDocWasmUrl from "@firecrawl/anydoc-wasm/anydoc_wasm_bg.wasm?url";

export interface PdfMarkdownParser {
    parsePage(pdfBytes: Uint8Array): Promise<string>;
}

export class AnyDocPdfParser implements PdfMarkdownParser {
    private initializationPromise: Promise<void> | null = null;

    async parsePage(pdfBytes: Uint8Array): Promise<string> {
        await this.initialize();
        return toMarkdownBytes(pdfBytes, "pdf");
    }

    private async initialize(): Promise<void> {
        if (this.initializationPromise === null) {
            this.initializationPromise = this.loadWasm().catch((error) => {
                this.initializationPromise = null;
                throw error;
            });
        }
        await this.initializationPromise;
    }

    private async loadWasm(): Promise<void> {
        const response = await fetch(anyDocWasmUrl);
        if (!response.ok) {
            throw new Error(`Unable to load AnyDoc WASM (status ${response.status}).`);
        }
        await initializeAnyDoc({module_or_path: await response.arrayBuffer()});
    }
}

export const anyDocPdfParser = new AnyDocPdfParser();
