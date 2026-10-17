export type DocumentFormat = "pdf" | "epub";

export interface PreparedDocumentPage {
    pageNo: number;
    bytes: Uint8Array;
}
