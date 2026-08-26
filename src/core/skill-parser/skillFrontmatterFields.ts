import type {SkillFileData} from "../stores/skill-file-store/types";

export type SkillFrontmatterDataKey = Exclude<keyof SkillFileData, "content">;

export type SkillFrontmatterFieldDefinition = {
    [K in SkillFrontmatterDataKey]: {
        key: string;
        dataKey: K;
        valueType: NonNullable<SkillFileData[K]> extends boolean ? "boolean" : "string";
        required?: boolean;
    };
}[SkillFrontmatterDataKey];

export const SKILL_FRONTMATTER_FIELDS = [
    {key: "name", dataKey: "name", valueType: "string", required: true},
    {key: "description", dataKey: "description", valueType: "string", required: true},
    {
        key: "disable-model-invocation",
        dataKey: "disableModelInvocation",
        valueType: "boolean"
    },
    {key: "built-in-skill", dataKey: "builtInSkill", valueType: "boolean"},
    {
        key: "built-in-skill-user-controllable",
        dataKey: "builtInSkillUserControllable",
        valueType: "boolean"
    }
] as const satisfies readonly SkillFrontmatterFieldDefinition[];

export const SKILL_FRONTMATTER_KEYS = Object.freeze(
    Object.fromEntries(SKILL_FRONTMATTER_FIELDS.map((field) => [field.dataKey, field.key]))
) as {
    readonly [K in (typeof SKILL_FRONTMATTER_FIELDS)[number] as K["dataKey"]]: K["key"];
};

export type SkillFrontmatterValues = Partial<Pick<SkillFileData, SkillFrontmatterDataKey>>;

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
