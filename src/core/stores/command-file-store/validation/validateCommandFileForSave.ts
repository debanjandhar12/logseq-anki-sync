import {parseCommandFile} from "../../../command-parser/parseCommandFile";
import {validateFrontmatterTemplate} from "../../../template-engine/parser/validateFrontmatterTemplate";
import {CommandFileStore} from "../CommandFileStore";
import {commandFileNameSchema} from "./validateCommandFileName";

export async function validateCommandFileForSave(content: string) {
    if (!content.trim()) throw new Error("Command content cannot be empty");
    const parsed = parseCommandFile(content);
    commandFileNameSchema.parse(CommandFileStore.getCommandFileName(parsed));
    const issue = (await validateFrontmatterTemplate(content))[0];
    if (issue) throw new Error(issue.message);
    return parsed;
}
