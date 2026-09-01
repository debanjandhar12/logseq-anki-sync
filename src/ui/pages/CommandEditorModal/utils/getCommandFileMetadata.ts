import matter from "gray-matter";
import {readCommandFrontmatterValues} from "src/core/command-parser";
import type {CommandFileData} from "src/core/stores/command-file-store/types";

export function getCommandFileMetadata(
    content: string
): Pick<
    CommandFileData,
    | "name"
    | "invokeLocations"
    | "userInvocable"
    | "commandInvokeInNewThread"
    | "builtInCommand"
    | "builtInCommandUserControllable"
> | null {
    try {
        if (!matter.test(content)) return null;

        const values = readCommandFrontmatterValues(matter(content).data);
        return {
            name: values.name ?? "",
            invokeLocations: values.invokeLocations ?? [],
            userInvocable: values.userInvocable !== false,
            commandInvokeInNewThread: values.commandInvokeInNewThread !== false,
            builtInCommand: values.builtInCommand,
            builtInCommandUserControllable: values.builtInCommandUserControllable
        };
    } catch {
        return null;
    }
}
