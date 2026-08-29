import {
    AddAttachmentCommand,
    type ChatCommand,
    ClearComposerCommand,
    NewThreadCommand,
    OpenAIChatCommand,
    SetComposerTextCommand
} from "../chat-interop";
import {renderCommandFileTemplate} from "../command-parser";
import type {CommandFileData} from "../stores/command-file-store/types";
import type {CommandInvocationContext, UserCommand} from "./types";

export function createUserCommand(
    commandFile: CommandFileData,
    context: CommandInvocationContext
): UserCommand {
    return {
        name: commandFile.name,
        builtInCommand: commandFile.builtInCommand === true,
        execute: async () => {
            // Rendering must succeed before any destructive composer operation is queued.
            const prompt = await renderCommandFileTemplate(commandFile.content);
            const steps: ChatCommand[] = [
                ...(commandFile.commandInvokeInNewThread ? [new NewThreadCommand()] : []),
                new ClearComposerCommand(),
                ...("uuid" in context ? [new AddAttachmentCommand(context.uuid)] : []),
                new SetComposerTextCommand(prompt)
            ];

            // Every step enqueues synchronously, keeping this invocation contiguous.
            await Promise.all(steps.map((step) => step.execute()));
            await new OpenAIChatCommand().execute();
        }
    };
}
