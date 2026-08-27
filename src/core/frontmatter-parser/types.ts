export interface FrontmatterSplit {
    prefix: string;
    body: string;
    matterRange: {from: number; to: number} | null;
}
