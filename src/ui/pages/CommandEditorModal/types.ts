export interface EditableCommandFile {
    id: string;
    content: string;
    originalFileName?: string;
    originalContent?: string;
}

export interface OriginalBuiltInCommandFile {
    fileName: string;
    content: string;
}
