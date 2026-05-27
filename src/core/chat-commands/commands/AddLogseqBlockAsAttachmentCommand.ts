import type {BlockUUID} from "@logseq/libs/dist/LSPlugin";
import {createLogger, LoggerCategory} from "../../../logger";
import type {ChatCommand} from "../types";

const logger = createLogger(LoggerCategory.MISC);

/**
 * Fetches a Logseq block and stores it as a pending attachment for AI Chat.
 */
export class AddLogseqBlockAsAttachmentCommand implements ChatCommand {
    constructor(private readonly uuid: BlockUUID) {}

    async execute(): Promise<void> {
        try {

        } catch (error) {
            logger.error("Failed to add block to AI Chat", error);
        }
    }
}
