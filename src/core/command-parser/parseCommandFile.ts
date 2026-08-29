import type {CommandFileData} from "../stores/command-file-store/types";
import {validateCommandFileContent} from "./validateCommandFileContent";

export function parseCommandFile(content: string): CommandFileData {
    const result = validateCommandFileContent(content);
    if (!result.valid) throw new Error(result.issues[0].message);
    return result.commandFile;
}
