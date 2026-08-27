import {SKILL_FRONTMATTER_FIELDS} from "./constants";
import type {SkillFrontmatterValues} from "./types";

export function readSkillFrontmatterValues(data: Record<string, unknown>): SkillFrontmatterValues {
    const values: SkillFrontmatterValues = {};

    for (const field of SKILL_FRONTMATTER_FIELDS) {
        const value = data[field.key];
        if (field.valueType === "string" && typeof value === "string") {
            Object.assign(values, {[field.dataKey]: value.trim()});
        } else if (field.valueType === "boolean" && typeof value === "boolean") {
            Object.assign(values, {[field.dataKey]: value});
        }
    }

    return values;
}
