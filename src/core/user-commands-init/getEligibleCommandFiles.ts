import {CommandFileStore} from "../stores/command-file-store/CommandFileStore";
import type {CommandFileData} from "../stores/command-file-store/types";
import {ADD_AS_ATTACHMENT_COMMAND_NAME} from "./constants";
import type {CommandInvocationContext} from "./types";

function compareCommandFiles(left: CommandFileData, right: CommandFileData): number {
    if (left.name === ADD_AS_ATTACHMENT_COMMAND_NAME) return -1;
    if (right.name === ADD_AS_ATTACHMENT_COMMAND_NAME) return 1;
    return left.name.localeCompare(right.name);
}

export async function getEligibleCommandFiles(
    context: CommandInvocationContext
): Promise<CommandFileData[]> {
    return (await CommandFileStore.getAllCommandFiles())
        .filter((commandFile) => commandFile.userInvocable)
        .filter((commandFile) => commandFile.invokeLocations.includes(context.location))
        .sort(compareCommandFiles);
}
