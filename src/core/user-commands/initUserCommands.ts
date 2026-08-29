import {initBuiltInCommandFiles} from "./initBuiltInCommandFiles";
import {
    registerContextMenuUserCommands,
    registerNativeUserCommands
} from "./registerCommandEntryPoints";

export async function initUserCommands(): Promise<void> {
    await initBuiltInCommandFiles();
    registerContextMenuUserCommands();
    await registerNativeUserCommands();
}
