import {AddAttachmentCommand} from "src/core/chat-interop/commands/AddAttachmentCommand";
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
    const addBlockToAIChat = async (e) => {
        let uuid = e.uuid;
        if (!uuid && e.page) {
            const page = await logseq.Editor.getPage(e.page);
            uuid = page.uuid;
        }
        if (!uuid) throw new Error("addBlockToAIChat: Could not find block UUID");
        const command = new AddAttachmentCommand(uuid);
        await command.execute();
        await new OpenAIChatCommand().execute();
    };
    logseq.Editor.registerBlockContextMenuItem("Add to AI Chat", addBlockToAIChat);
    logseq.App.registerPageMenuItem("Add to AI Chat", addBlockToAIChat);
};
