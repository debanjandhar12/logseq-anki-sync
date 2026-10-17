import {parseSkillFile} from "../../../skill-parser/parseSkillFile";
import {validateFrontmatterTemplate} from "../../../template-engine/parser/validateFrontmatterTemplate";

export async function validateSkillFileForSave(content: string) {
    if (!content.trim()) throw new Error("Skill content cannot be empty");
    const parsed = parseSkillFile(content);
    const issue = (await validateFrontmatterTemplate(content))[0];
    if (issue) throw new Error(issue.message);
    return parsed;
}
