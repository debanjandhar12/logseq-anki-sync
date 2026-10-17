import {parseCommandFile} from "../../../command-parser/parseCommandFile";
import {validateFrontmatterTemplate} from "../../../template-engine/parser/validateFrontmatterTemplate";
import {commandNameSchema} from "./commandNameSchema";

export async function validateCommandFileForSave(content: string) {
    if (!content.trim()) throw new Error("Command content cannot be empty");
    const parsed = parseCommandFile(content);
    commandNameSchema.parse(parsed.name);
    const issue = (await validateFrontmatterTemplate(content))[0];
    if (issue) throw new Error(issue.message);
    return parsed;
}
