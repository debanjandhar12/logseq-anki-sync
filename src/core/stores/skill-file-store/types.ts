export interface SkillFileData {
    name: string;
    description: string;
    content: string;
    builtInSkill?: boolean;
    builtInSkillUserControllable?: boolean;
    disableModelInvocation?: boolean;
}
