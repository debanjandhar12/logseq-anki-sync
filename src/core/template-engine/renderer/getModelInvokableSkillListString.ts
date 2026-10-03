import {SkillStore} from "../../stores/skill-store/SkillStore";

export async function getModelInvokableSkillListString(): Promise<string> {
    const skillFiles = await SkillStore.getAllSkills();

    return skillFiles
        .filter((skillFile) => skillFile.disableModelInvocation !== true) // for false / null, we list the skill
        .map((skillFile) => `* ${skillFile.name} - ${skillFile.description}`)
        .join("\n");
}
