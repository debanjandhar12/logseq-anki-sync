import {HighlightMaskNote} from "../../anki-notes/HighlightMaskNote";
import {createLogger, LoggerCategory} from "../../logger";

const logger = createLogger(LoggerCategory.Others);

export async function openEditor(blockId: string): Promise<void> {
    try {
        await HighlightMaskNote.handleHighlightMaskOperation({uuid: blockId});
    } catch (error) {
        logger.error("Failed to open the highlight mask editor.", error);
        await logseq.UI.showMsg(
            "Failed to open the highlight mask editor. See plugin logs for details.",
            "error"
        );
    }
}
