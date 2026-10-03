import type {SkillFileData} from "../stores/skill-store/types";
import {validateSkillFileContent} from "./validateSkillFileContent";

export function parseSkillFile(content: string): SkillFileData {
    const result = validateSkillFileContent(content);
    if (!result.valid) throw new Error(result.issues[0].message);
    return result.skillFile;
}
