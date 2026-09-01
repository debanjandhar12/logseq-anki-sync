import matter from "gray-matter";
import {COMMAND_FRONTMATTER_KEYS} from "src/core/command-parser";
import type {CommandInvokeLocation} from "src/core/stores/command-file-store/types";

export function updateCommandUserInvocable(content: string, enabled: boolean): string {
    return updateCommandMetadata(content, {
        [COMMAND_FRONTMATTER_KEYS.userInvocable]: enabled
    });
}

export function updateCommandInvokeLocations(
    content: string,
    locations: readonly CommandInvokeLocation[]
): string {
    return updateCommandMetadata(content, {
        [COMMAND_FRONTMATTER_KEYS.invokeLocations]: [...locations]
    });
}

function updateCommandMetadata(content: string, updates: Record<string, unknown>): string {
    const parsed = matter(content);
    return matter.stringify(parsed.content, {...parsed.data, ...updates});
}
