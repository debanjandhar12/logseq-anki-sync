import {CommandQueue} from "../CommandQueue";
import type {BlockUUID} from "@logseq/libs/dist/LSPlugin";
import {createLogger, LoggerCategory} from "../../../logger";
import type {ChatCommand} from "../types";

const logger = createLogger(LoggerCategory.MISC);

/**
 * Fetches a Logseq block and stores it as a pending attachment for AI Chat.
 */
export class AddLogseqBlockAsAttachmentCommand implements ChatCommand {
    static readonly TYPE = "add-block-as-attachment";

    constructor(private readonly uuid: BlockUUID) {}

    async execute(): Promise<void> {
        try {
            CommandQueue.enqueue({
                type: AddLogseqBlockAsAttachmentCommand.TYPE,
                payload: {uuid: this.uuid}
            });
        } catch (error) {
            logger.error("Failed to add block to AI Chat", error);
        }
    }
}
