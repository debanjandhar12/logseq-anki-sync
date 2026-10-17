import {LogseqPluginStorageManager} from "src/logseq/LogseqPluginStorageManager";

export interface StoredAnyDocPage {
    pageNo: number;
    content: string;
}

export class AnyDocParseResultStore {
    static readonly groupName = "anydoc-parse-results";

    static getFileName(fileHash: string, pageNo: number): string {
        AnyDocParseResultStore.validateFileHash(fileHash);
        if (!Number.isSafeInteger(pageNo) || pageNo < 1)
            throw new Error("Invalid document page number.");
        return `${fileHash}-page-${pageNo}.md`;
    }

    static async getPages(fileHash: string): Promise<StoredAnyDocPage[]> {
        AnyDocParseResultStore.validateFileHash(fileHash);
        const filePattern = new RegExp(`^${fileHash}-page-([1-9]\\d*)\\.md$`);
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
        return pages.filter((page): page is StoredAnyDocPage => typeof page.content === "string");
    }

    static async save(fileHash: string, pageNo: number, markdown: string): Promise<void> {
        const fileName = AnyDocParseResultStore.getFileName(fileHash, pageNo);
        await LogseqPluginStorageManager.saveFile(
            AnyDocParseResultStore.groupName,
            fileName,
            markdown
        );
    }

    private static validateFileHash(fileHash: string): void {
        if (!/^[a-f0-9]{64}$/.test(fileHash)) throw new Error("Invalid file hash.");
    }
}
