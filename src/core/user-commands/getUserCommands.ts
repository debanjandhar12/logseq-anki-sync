import {CommandFileStore} from "../stores/command-file-store/CommandFileStore";
import type {CommandFileData} from "../stores/command-file-store/types";
import {ADD_AS_ATTACHMENT_COMMAND_NAME} from "./constants";
import {createUserCommand} from "./createUserCommand";
import type {CommandInvocationContext, UserCommand} from "./types";

function compareCommandFiles(left: CommandFileData, right: CommandFileData): number {
    if (left.name === ADD_AS_ATTACHMENT_COMMAND_NAME) return -1;
    if (right.name === ADD_AS_ATTACHMENT_COMMAND_NAME) return 1;
    return left.name.localeCompare(right.name);
}

async function getEligibleCommandFiles(
    context: CommandInvocationContext
): Promise<CommandFileData[]> {
    return (await CommandFileStore.getAllCommandFiles())
        .filter((commandFile) => commandFile.userInvocable)
        .filter((commandFile) => commandFile.invokeConditions.includes(context.condition))
        .sort(compareCommandFiles);
}

export async function getUserCommands(context: CommandInvocationContext): Promise<UserCommand[]> {
    return (await getEligibleCommandFiles(context)).map((commandFile) =>
        createUserCommand(commandFile, context)
    );
}

export async function findUserCommand(
    name: string,
    context: CommandInvocationContext
): Promise<UserCommand | null> {
    const commands = await getUserCommands(context);
    return commands.find((command) => command.name === name) ?? null;
}
