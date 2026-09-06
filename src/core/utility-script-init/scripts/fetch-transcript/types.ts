export interface ParsedVideoInput {
    provider: "youtube" | "bilibili";
    videoId: string;
    page: number;
}

export interface TranscriptSegment {
    start: number;
    duration: number;
    text: string;
}

export interface TranscriptResult {
    provider: ParsedVideoInput["provider"];
    videoId: string;
    title?: string;
    language: string;
    segments: TranscriptSegment[];
}
