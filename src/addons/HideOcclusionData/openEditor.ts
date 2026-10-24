import {ImageOcclusionNote} from "../../anki-notes/ImageOcclusionNote";
import {createLogger, LoggerCategory} from "../../logger";

const logger = createLogger(LoggerCategory.Others);

export async function openEditor(blockId: string): Promise<void> {
    try {
        await ImageOcclusionNote.handleImageOcclusionOperation({uuid: blockId});
    } catch (error) {
        logger.error("Failed to open the occlusion editor.", error);
        await logseq.UI.showMsg(
            "Failed to open the occlusion editor. See plugin logs for details.",
            "error"
        );
    }
}
