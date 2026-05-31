import matter from "gray-matter";
import type {SkillFileData} from "../stores/skill-file-store/types";

export function parseSkillFile(content: string): SkillFileData {
    if (!matter.test(content)) {
        throw new Error("Invalid skill file structure: frontmatter is required");
    }

    const parsed = matter(content);
    const name = parsed.data.name;
    const description = parsed.data.description;
    const defaultValue = parsed.data.default;
    const disableModelInvocation = parsed.data["disable-model-invocation"];

    if (typeof name !== "string" || name.trim().length === 0) {
        throw new Error("Invalid skill file metadata: name is required");
    }

    if (typeof description !== "string" || description.trim().length === 0) {
        throw new Error("Invalid skill file metadata: description is required");
    }

    if (defaultValue !== undefined && typeof defaultValue !== "boolean") {
        throw new Error("Invalid skill file metadata: default must be a boolean");
    }

    if (disableModelInvocation !== undefined && typeof disableModelInvocation !== "boolean") {
        throw new Error("Invalid skill file metadata: disable-model-invocation must be a boolean");
    }

    return {
        name: name.trim(),
        description: description.trim(),
        content,
        default: defaultValue,
        disableModelInvocation
    };
}
