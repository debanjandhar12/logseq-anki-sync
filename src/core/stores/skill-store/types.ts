export interface SkillFileData {
    name: string;
    description: string;
    content: string;
    builtInSkill?: boolean;
    builtInSkillUserControllable?: boolean;
    disableModelInvocation?: boolean;
}

export interface EditedSkill {
    content: string;
    originalSkillName?: string;
}

export interface BundledSkill extends SaveSkillFileOptions {
    content: string;
}

export type SkillResourceFiles = Record<string, string>;
export type SkillFolderFiles = Record<string, string>;

export interface SaveSkillFileOptions {
    references?: SkillResourceFiles;
    scripts?: SkillResourceFiles;
}

export interface StoredSkill extends SkillFileData {
    folderName: string;
}

export interface HashOptions {
    ignoreDisableModelInvocation?: boolean;
}
