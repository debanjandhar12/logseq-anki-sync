import matter from "gray-matter";
import type {SkillFileData} from "../stores/skill-file-store/types";

export function parseSkillFile(content: string): SkillFileData {
    if (!matter.test(content)) {
        throw new Error("Invalid skill file structure: frontmatter is required");
    }

    const parsed = matter(content);
    const name = parsed.data.name;
    const description = parsed.data.description;
    const builtInSkill = parsed.data["built-in-skill"];
    const builtInSkillUserControllable = parsed.data["built-in-skill-user-controllable"];
    const disableModelInvocation = parsed.data["disable-model-invocation"];

    if (typeof name !== "string" || name.trim().length === 0) {
        throw new Error("Invalid skill file metadata: name is required");
    }

    if (typeof description !== "string" || description.trim().length === 0) {
        throw new Error("Invalid skill file metadata: description is required");
    }

    if (builtInSkill !== undefined && typeof builtInSkill !== "boolean") {
        throw new Error("Invalid skill file metadata: built-in-skill must be a boolean");
    }

    if (
        builtInSkillUserControllable !== undefined &&
        typeof builtInSkillUserControllable !== "boolean"
    ) {
        throw new Error(
            "Invalid skill file metadata: built-in-skill-user-controllable must be a boolean"
        );
    }

    if (disableModelInvocation !== undefined && typeof disableModelInvocation !== "boolean") {
        throw new Error("Invalid skill file metadata: disable-model-invocation must be a boolean");
    }

    return {
        name: name.trim(),
        description: description.trim(),
        content,
        builtInSkill,
        builtInSkillUserControllable,
        disableModelInvocation
    };
}
