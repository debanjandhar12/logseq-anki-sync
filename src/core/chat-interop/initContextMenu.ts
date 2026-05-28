import {AddLogseqBlockAsAttachmentCommand} from "src/core/chat-interop/commands/AddLogseqBlockAsAttachmentCommand";
import {OpenAIChatCommand} from "src/core/chat-interop/commands/OpenAIChatCommand";

/**
 * This attempts registers AI Chat related context menu items in Logseq.
 */
export const initContextMenu = async () => {
    logseq.provideModel({
        showAIChat: () => new OpenAIChatCommand().execute()
    });
    logseq.App.registerCommandPalette(
        {
            key: `logseq-ai-chat-command-palette-${logseq.baseInfo.id}`,
            label: `Open Logseq AI Chat`,
            keybinding: {mode: "global", binding: ""}
        },
        () => new OpenAIChatCommand().execute()
    );
    logseq.Editor.registerBlockContextMenuItem("Add to AI Chat", async (e) => {
        const command = new AddLogseqBlockAsAttachmentCommand(e.uuid);
        await command.execute();
        await new OpenAIChatCommand().execute();
    });
};
