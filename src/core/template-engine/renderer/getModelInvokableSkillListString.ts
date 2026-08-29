import {SkillFileStore} from "../../stores/skill-file-store/SkillFileStore";

export async function getModelInvokableSkillListString(): Promise<string> {
    const skillFiles = await SkillFileStore.getAllSkillFile();

    return skillFiles
        .filter((skillFile) => skillFile.disableModelInvocation !== true) // for false / null, we list the skill
        .map((skillFile) => `* ${skillFile.name}.md - ${skillFile.description}`)
        .join("\n");
}
