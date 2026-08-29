import {createLogger, LoggerCategory} from "../../logger";
import {showAICommandPaletteModal} from "../../ui/launchers/showAICommandPaletteModal";
import {
    classifyBlockCommandInvocationContext,
    classifyPageCommandInvocationContext
} from "./classifyCommandInvocationContext";
import {findUserCommand, getUserCommands} from "./getUserCommands";
import type {
    CommandCenterInvocationContext,
    CommandInvocationContext,
    ContextMenuCommandInvocationContext,
    SlashCommandInvocationContext
} from "./types";

const logger = createLogger(LoggerCategory.MISC);
const registeredNativeKeys = new Set<string>();

export function registerContextMenuUserCommands(): void {
    logseq.Editor.registerBlockContextMenuItem("Invoke AI Command", async ({uuid}) => {
        await pickAndExecuteUserCommand(() => classifyBlockCommandInvocationContext(uuid));
    });
    logseq.App.registerPageMenuItem("Invoke AI Command", async ({page}) => {
        await pickAndExecuteUserCommand(() => classifyPageCommandInvocationContext(page));
    });
}

export async function registerNativeUserCommands(): Promise<void> {
    const commandCenterContext: CommandCenterInvocationContext = {
        source: "command-center",
        condition: "Logseq Command Center"
    };
    await registerCommandCenterCommands(commandCenterContext);

    const slashProbeContext: SlashCommandInvocationContext = {
        source: "block-slash-command",
        condition: "Block Slash Command",
        uuid: ""
    };
    await registerSlashCommands(slashProbeContext);
}

async function registerCommandCenterCommands(
    context: CommandCenterInvocationContext
): Promise<void> {
    for (const {name} of await getUserCommands(context)) {
        const key = createNativeCommandKey("command-center", name);
        if (registeredNativeKeys.has(key)) continue;

        try {
            logseq.App.registerCommandPalette(
                {key, label: name, keybinding: {mode: "global", binding: ""}},
                () => executeNativeUserCommand(name, context)
            );
            registeredNativeKeys.add(key);
        } catch (error) {
            logger.error(`Failed to register AI command "${name}" in Command Center`, error);
        }
    }
}

async function registerSlashCommands(context: SlashCommandInvocationContext): Promise<void> {
    for (const {name} of await getUserCommands(context)) {
        const key = createNativeCommandKey("slash", name);
        if (registeredNativeKeys.has(key)) continue;

        try {
            logseq.Editor.registerSlashCommand(name, async ({uuid}) => {
                if (typeof uuid !== "string" || uuid === "") {
                    await logseq.UI.showMsg("Could not determine the current block.", "error");
                    return;
                }
                await executeNativeUserCommand(name, {
                    source: "block-slash-command",
                    condition: "Block Slash Command",
                    uuid
                });
            });
            registeredNativeKeys.add(key);
        } catch (error) {
            logger.error(`Failed to register AI slash command "${name}"`, error);
        }
    }
}

async function pickAndExecuteUserCommand(
    classify: () => Promise<ContextMenuCommandInvocationContext>
): Promise<void> {
    try {
        const commands = await getUserCommands(await classify());
        if (commands.length === 0) {
            await logseq.UI.showMsg("No AI commands are available here.", "warning");
            return;
        }

        const selectedCommand = await showAICommandPaletteModal(commands);
        await selectedCommand?.execute();
    } catch (error) {
        logger.error("Failed to invoke AI command", error);
        await logseq.UI.showMsg("Failed to invoke AI command.", "error");
    }
}

async function executeNativeUserCommand(
    name: string,
    context: CommandInvocationContext
): Promise<void> {
    try {
        const command = await findUserCommand(name, context);
        if (!command) {
            await logseq.UI.showMsg(
                `"${name}" is no longer available. Reload the plugin to remove it.`,
                "warning"
            );
            return;
        }
        await command.execute();
    } catch (error) {
        logger.error(`Failed to invoke native AI command "${name}"`, error);
        await logseq.UI.showMsg(`Failed to invoke "${name}".`, "error");
    }
}

function createNativeCommandKey(route: "command-center" | "slash", name: string): string {
    const slug = name
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48);
    let hash = 2166136261;
    for (const character of name) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return `${logseq.baseInfo.id}-ai-command-${route}-${slug || "command"}-${(hash >>> 0).toString(36)}`;
}
