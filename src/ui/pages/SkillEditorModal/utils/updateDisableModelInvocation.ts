import matter from "gray-matter";
import {SKILL_FRONTMATTER_KEYS} from "src/core/skill-parser";

export function updateDisableModelInvocation(
    content: string,
    disableModelInvocation: boolean
): string {
    if (!matter.test(content)) {
        return matter.stringify(content, {
            [SKILL_FRONTMATTER_KEYS.disableModelInvocation]: disableModelInvocation
        });
    }

    const parsed = matter(content);
    return matter.stringify(parsed.content, {
        ...parsed.data,
        [SKILL_FRONTMATTER_KEYS.disableModelInvocation]: disableModelInvocation
    });
}
