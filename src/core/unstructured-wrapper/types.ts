export interface PreparedPdfPage {
    pageNo: number;
    fileName: string;
    bytes: Uint8Array;
    hash: string;
}

export interface ParsedPdfPage {
    pageNo: number;
    elements: Array<Record<string, unknown>>;
    content: string;
}

export interface UnstructuredWrapperOptions {
    apiKey: string;
    apiUrl: string;
    fetcher?: typeof fetch;
    pollIntervalMs?: number;
    timeoutMs?: number;
}
