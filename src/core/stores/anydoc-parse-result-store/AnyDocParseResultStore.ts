import {LogseqPluginStorageManager} from "src/logseq/LogseqPluginStorageManager";

export class AnyDocParseResultStore {
    static readonly groupName = "anydoc-parse-results";

    static getFileName(pdfHash: string, pageNo: number): string {
        if (!/^[a-f0-9]{64}$/.test(pdfHash)) throw new Error("Invalid PDF hash.");
        if (!Number.isInteger(pageNo) || pageNo < 1) throw new Error("Invalid PDF page number.");
        return `${pdfHash}-page-${pageNo}.md`;
    }

    static async exists(pdfHash: string, pageNo: number): Promise<boolean> {
        return LogseqPluginStorageManager.fileExists(
            AnyDocParseResultStore.groupName,
            AnyDocParseResultStore.getFileName(pdfHash, pageNo)
        );
    }

    static async save(pdfHash: string, pageNo: number, markdown: string): Promise<string> {
        const fileName = AnyDocParseResultStore.getFileName(pdfHash, pageNo);
        await LogseqPluginStorageManager.saveFile(
            AnyDocParseResultStore.groupName,
            fileName,
            markdown
        );
        return fileName;
    }
}
