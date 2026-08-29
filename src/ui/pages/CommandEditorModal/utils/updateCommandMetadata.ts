import matter from "gray-matter";
import {COMMAND_FRONTMATTER_KEYS} from "src/core/command-parser";
import type {CommandInvokeCondition} from "src/core/stores/command-file-store/types";

export function updateCommandUserInvocable(content: string, enabled: boolean): string {
    return updateCommandMetadata(content, {
        [COMMAND_FRONTMATTER_KEYS.userInvocable]: enabled
    });
}

export function updateCommandInvokeConditions(
    content: string,
    conditions: readonly CommandInvokeCondition[]
): string {
    return updateCommandMetadata(content, {
        [COMMAND_FRONTMATTER_KEYS.invokeConditions]: [...conditions]
    });
}

function updateCommandMetadata(content: string, updates: Record<string, unknown>): string {
    const parsed = matter(content);
    return matter.stringify(parsed.content, {...parsed.data, ...updates});
}
