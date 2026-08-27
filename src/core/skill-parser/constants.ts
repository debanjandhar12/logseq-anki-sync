import type {SkillFrontmatterFieldDefinition} from "./types";

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

export const FRONTMATTER_MUSTACHE_MESSAGE =
    "Mustache templates are not supported in skill file frontmatter.";
