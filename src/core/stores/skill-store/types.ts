import type {SkillFileData} from "../skill-file-store/types";

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
