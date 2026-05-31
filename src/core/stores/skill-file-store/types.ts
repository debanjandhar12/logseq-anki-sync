export interface SkillFileData {
    name: string;
    description: string;
    content: string;
    defaultInstalledSkill?: boolean;
    disableModelInvocation?: boolean;
}
