import type {EditableSkillFile} from "../types";

export function getFilesSnapshot(files: EditableSkillFile[]): string {
    return JSON.stringify(
        files.map((file) => ({
            content: file.content,
            originalFileName: file.originalFileName ?? null
        }))
    );
}
