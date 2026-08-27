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

export type SkillFrontmatterValues = Partial<Pick<SkillFileData, SkillFrontmatterDataKey>>;
