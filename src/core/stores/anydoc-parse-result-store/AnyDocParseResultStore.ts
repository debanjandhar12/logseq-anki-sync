import {LogseqPluginStorageManager} from "src/logseq/LogseqPluginStorageManager";

export interface StoredAnyDocPdfPage {
    pageNo: number;
    content: string;
}

export class AnyDocParseResultStore {
    static readonly groupName = "anydoc-parse-results";

    static getFileName(pdfHash: string, pageNo: number): string {
        AnyDocParseResultStore.validatePdfHash(pdfHash);
        if (!Number.isInteger(pageNo) || pageNo < 1) throw new Error("Invalid PDF page number.");
        return `${pdfHash}-page-${pageNo}.md`;
    }

    static async getPages(pdfHash: string): Promise<StoredAnyDocPdfPage[]> {
        AnyDocParseResultStore.validatePdfHash(pdfHash);
        const filePattern = new RegExp(`^${pdfHash}-page-([1-9]\\d*)\\.md$`);
        const matchingFiles = (
            await LogseqPluginStorageManager.getFiles(AnyDocParseResultStore.groupName)
        )
            .map((fileName) => {
                const match = filePattern.exec(fileName);
                return match === null ? null : {fileName, pageNo: Number(match[1])};
            })
            .filter(
                (file): file is {fileName: string; pageNo: number} =>
                    file !== null && Number.isSafeInteger(file.pageNo)
            )
            .sort((first, second) => first.pageNo - second.pageNo);

        const pages = await Promise.all(
            matchingFiles.map(async ({fileName, pageNo}) => ({
                pageNo,
                content: await LogseqPluginStorageManager.getFileContent(
                    AnyDocParseResultStore.groupName,
                    fileName
                )
            }))
        );
        return pages.filter(
            (page): page is StoredAnyDocPdfPage => typeof page.content === "string"
        );
    }

    static async save(pdfHash: string, pageNo: number, markdown: string): Promise<void> {
        const fileName = AnyDocParseResultStore.getFileName(pdfHash, pageNo);
        await LogseqPluginStorageManager.saveFile(
            AnyDocParseResultStore.groupName,
            fileName,
            markdown
        );
    }

    private static validatePdfHash(pdfHash: string): void {
        if (!/^[a-f0-9]{64}$/.test(pdfHash)) throw new Error("Invalid PDF hash.");
    }
}
