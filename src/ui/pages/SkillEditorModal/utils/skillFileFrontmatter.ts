import matter from "gray-matter";
import {
    readSkillFrontmatterValues,
    SKILL_FRONTMATTER_KEYS
} from "src/core/skill-parser/skillFrontmatterFields";
import type {SkillFileData} from "src/core/stores/skill-file-store/types";

const UNTITLED_FILE_NAME = "Untitled.md";

export function getSkillFileMetadata(
    content: string
): Pick<
    SkillFileData,
    "name" | "builtInSkill" | "builtInSkillUserControllable" | "disableModelInvocation"
> | null {
    try {
        if (!matter.test(content)) {
            return null;
        }

        const parsed = matter(content);
        const values = readSkillFrontmatterValues(parsed.data);

        return {
            name: values.name ?? "",
            builtInSkill: values.builtInSkill,
            builtInSkillUserControllable: values.builtInSkillUserControllable,
            disableModelInvocation: values.disableModelInvocation
        };
    } catch {
        return null;
    }
}

export function getDisplayFileName(content: string): string {
    const metadata = getSkillFileMetadata(content);
    return metadata?.name ? `${metadata.name}.md` : UNTITLED_FILE_NAME;
}

export function getSkillFileName(skillFileData: Pick<SkillFileData, "name">): string {
    return `${skillFileData.name}.md`;
}

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
