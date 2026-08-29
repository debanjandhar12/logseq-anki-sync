import {getCommandFileMetadata} from "./getCommandFileMetadata";

export function getCommandFileDisplayName(content: string): string {
    const name = getCommandFileMetadata(content)?.name;
    return name ? `${name}.md` : "Untitled.md";
}
