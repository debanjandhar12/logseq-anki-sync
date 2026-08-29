import {LogseqModelAction} from "src/constants";
import {OpenAIChatCommand} from "src/core/chat-interop/commands/OpenAIChatCommand";

/**
 * This attempts registers AI Chat related context menu items in Logseq.
 */
export const initContextMenu = async () => {
    logseq.provideModel({
        [LogseqModelAction.SHOW_AI_CHAT]: () => new OpenAIChatCommand().execute()
    });
    logseq.App.registerCommandPalette(
        {
            key: `logseq-ai-chat-command-palette-${logseq.baseInfo.id}`,
            label: `Open Logseq AI Chat`,
            keybinding: {mode: "global", binding: ""}
        },
        () => new OpenAIChatCommand().execute()
    );
};
