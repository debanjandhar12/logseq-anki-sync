import matter from "gray-matter";
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
        const name = parsed.data.name;
        const builtInSkill = parsed.data["built-in-skill"];
        const builtInSkillUserControllable = parsed.data["built-in-skill-user-controllable"];
        const disableModelInvocation = parsed.data["disable-model-invocation"];

        return {
            name: typeof name === "string" ? name.trim() : "",
            builtInSkill: typeof builtInSkill === "boolean" ? builtInSkill : undefined,
            builtInSkillUserControllable:
                typeof builtInSkillUserControllable === "boolean"
                    ? builtInSkillUserControllable
                    : undefined,
            disableModelInvocation:
                typeof disableModelInvocation === "boolean" ? disableModelInvocation : undefined
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
            "disable-model-invocation": disableModelInvocation
        });
    }

    const parsed = matter(content);
    return matter.stringify(parsed.content, {
        ...parsed.data,
        "disable-model-invocation": disableModelInvocation
    });
}
