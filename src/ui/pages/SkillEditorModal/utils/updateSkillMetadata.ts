import matter from "gray-matter";
import {SKILL_FRONTMATTER_KEYS} from "src/core/skill-parser";

export function updateDisableModelInvocation(
    content: string,
    disableModelInvocation: boolean
): string {
    return updateSkillMetadata(content, {
        [SKILL_FRONTMATTER_KEYS.disableModelInvocation]: disableModelInvocation
    });
}

export function updateSkillMetadata(content: string, updates: Record<string, unknown>): string {
    const parsed = matter(content);
    return matter.stringify(parsed.content, {
        ...parsed.data,
        ...updates
    });
}
