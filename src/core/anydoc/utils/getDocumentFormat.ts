import type {DocumentFormat} from "../types";

export function getDocumentFormat(path: string): DocumentFormat | undefined {
    const extension = path.trim().split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase();
    if (extension === "pdf" || extension === "epub") return extension;
    return undefined;
}
