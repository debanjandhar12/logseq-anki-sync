import {CommandFileStore} from "src/core/stores/command-file-store/CommandFileStore";
import type {CommandFileData} from "src/core/stores/command-file-store/types";

export function getCommandFileName(commandFile: Pick<CommandFileData, "name">): string {
    return CommandFileStore.getCommandFileName(commandFile);
}
