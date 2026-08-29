import type {EditableCommandFile} from "../types";

export function getCommandFilesSnapshot(files: readonly EditableCommandFile[]): string {
    return JSON.stringify(
        files.map((file) => ({
            content: file.content,
            originalFileName: file.originalFileName ?? null
        }))
    );
}
