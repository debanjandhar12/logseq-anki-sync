import matter from "gray-matter";
import {readSkillFrontmatterValues} from "src/core/skill-parser";
import type {SkillFileData} from "src/core/stores/skill-file-store/types";

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
