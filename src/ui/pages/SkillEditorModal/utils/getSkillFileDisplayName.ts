import {getSkillFileMetadata} from "./getSkillFileMetadata";

const UNTITLED_FILE_NAME = "Untitled.md";

export function getSkillFileDisplayName(content: string): string {
    const metadata = getSkillFileMetadata(content);
    return metadata?.name ? `${metadata.name}.md` : UNTITLED_FILE_NAME;
}
