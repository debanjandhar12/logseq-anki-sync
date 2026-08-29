import {createLogger, LoggerCategory} from "../../logger";
import {showAICommandPaletteModal} from "../../ui/launchers/showAICommandPaletteModal";
import {CommandFileStore} from "../stores/command-file-store/CommandFileStore";
import type {CommandFileData} from "../stores/command-file-store/types";
import {
    classifyBlockCommandInvocationContext,
    classifyPageCommandInvocationContext
} from "./classifyCommandInvocationContext";
import {createUserCommand} from "./createUserCommand";
import {getEligibleCommandFiles} from "./getEligibleCommandFiles";
import type {
    CommandCenterInvocationContext,
    ContextMenuCommandInvocationContext,
    SlashCommandInvocationContext
} from "./types";

const logger = createLogger(LoggerCategory.MISC);

export async function registerUserCommandEntryPoints(): Promise<void> {
    logseq.Editor.registerBlockContextMenuItem("Invoke AI Command", async ({uuid}) => {
        await executeContextMenuCommand(() => classifyBlockCommandInvocationContext(uuid));
    });
    logseq.App.registerPageMenuItem("Invoke AI Command", async ({page}) => {
        await executeContextMenuCommand(() => classifyPageCommandInvocationContext(page));
    });
    await registerSeparateContextMenuCommands();

    const commandCenterContext: CommandCenterInvocationContext = {
        source: "command-center",
        condition: "Logseq Command Center"
    };
    await registerCommandCenterCommands(commandCenterContext);

    const slashRegistrationContext: SlashCommandInvocationContext = {
        source: "block-slash-command",
        condition: "Block Slash Command",
        uuid: ""
    };
    await registerSlashCommands(slashRegistrationContext);
}

async function registerSeparateContextMenuCommands(): Promise<void> {
    const commandFiles = (await CommandFileStore.getAllCommandFiles()).filter(
        (commandFile) =>
            commandFile.userInvocable && commandFile.commandAppearSeparatelyInContextMenu
    );

    for (const commandFile of commandFiles) {
        try {
            if (
                commandFile.invokeConditions.some((condition) =>
                    condition.startsWith("Block Context Menu/")
                )
            ) {
                logseq.Editor.registerBlockContextMenuItem(commandFile.name, async ({uuid}) => {
                    await executeContextMenuCommand(
                        () => classifyBlockCommandInvocationContext(uuid),
                        commandFile
                    );
                });
            }
            if (
                commandFile.invokeConditions.some((condition) =>
                    condition.startsWith("Page Context Menu/")
                )
            ) {
                logseq.App.registerPageMenuItem(commandFile.name, async ({page}) => {
                    await executeContextMenuCommand(
                        () => classifyPageCommandInvocationContext(page),
                        commandFile
                    );
                });
            }
        } catch (error) {
            logger.error(`Failed to register separate AI command "${commandFile.name}"`, error);
        }
    }
}

async function registerCommandCenterCommands(
    context: CommandCenterInvocationContext
): Promise<void> {
    for (const commandFile of await getEligibleCommandFiles(context)) {
        const {name} = commandFile;
        const key = createCommandCenterKey(name);

        try {
            logseq.App.registerCommandPalette(
                {key, label: name, keybinding: {mode: "global", binding: ""}},
                () => executeNativeUserCommand(createUserCommand(commandFile, context))
            );
        } catch (error) {
            logger.error(`Failed to register AI command "${name}" in Command Center`, error);
        }
    }
}

async function registerSlashCommands(context: SlashCommandInvocationContext): Promise<void> {
    for (const commandFile of await getEligibleCommandFiles(context)) {
        const {name} = commandFile;

        try {
            logseq.Editor.registerSlashCommand(name, async ({uuid}) => {
                if (typeof uuid !== "string" || uuid === "") {
                    await logseq.UI.showMsg("Could not determine the current block.", "error");
                    return;
                }
                await executeNativeUserCommand(
                    createUserCommand(commandFile, {
                        source: "block-slash-command",
                        condition: "Block Slash Command",
                        uuid
                    })
                );
            });
        } catch (error) {
            logger.error(`Failed to register AI slash command "${name}"`, error);
        }
    }
}

async function executeContextMenuCommand(
    classify: () => Promise<ContextMenuCommandInvocationContext>,
    directCommandFile?: CommandFileData
): Promise<void> {
    try {
        const context = await classify();
        if (directCommandFile) {
            if (!directCommandFile.invokeConditions.includes(context.condition)) {
                await logseq.UI.showMsg(
                    `"${directCommandFile.name}" is not available here.`,
                    "warning"
                );
                return;
            }
            await createUserCommand(directCommandFile, context).execute();
            return;
        }

        const commands = (await getEligibleCommandFiles(context))
            .filter((commandFile) => !commandFile.commandAppearSeparatelyInContextMenu)
            .map((commandFile) => createUserCommand(commandFile, context));
        if (commands.length === 0) {
            await logseq.UI.showMsg("No AI commands are available here.", "warning");
            return;
        }

        const selectedCommand = await showAICommandPaletteModal(commands);
        await selectedCommand?.execute();
    } catch (error) {
        const commandName = directCommandFile?.name;
        logger.error(
            commandName
                ? `Failed to invoke AI command "${commandName}"`
                : "Failed to invoke AI command",
            error
        );
        await logseq.UI.showMsg(
            commandName ? `Failed to invoke "${commandName}".` : "Failed to invoke AI command.",
            "error"
        );
    }
}

async function executeNativeUserCommand(command: {name: string; execute(): Promise<void>}) {
    try {
        await command.execute();
    } catch (error) {
        logger.error(`Failed to invoke AI command "${command.name}"`, error);
        await logseq.UI.showMsg(`Failed to invoke "${command.name}".`, "error");
    }
}

function createCommandCenterKey(name: string): string {
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
    return `${logseq.baseInfo.id}-ai-command-command-center-${slug || "command"}-${(hash >>> 0).toString(36)}`;
}
