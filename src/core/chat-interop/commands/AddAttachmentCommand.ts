import type {BlockUUID} from "@logseq/libs/dist/LSPlugin";
import {createLogger, LoggerCategory} from "../../../logger";
import {ChatInteropCommandQueue} from "../queue/ChatInteropCommandQueue";
import type {ChatCommand} from "../types";

const logger = createLogger(LoggerCategory.MISC);

/** Adds any Logseq block-backed entity to the AI Chat composer. */
export class AddAttachmentCommand implements ChatCommand {
    static readonly TYPE = "add-attachment";

    constructor(private readonly uuid: BlockUUID) {}

    async execute(): Promise<void> {
        try {
            ChatInteropCommandQueue.enqueue({
                type: AddAttachmentCommand.TYPE,
                payload: {uuid: this.uuid}
            });
        } catch (error) {
            logger.error("Failed to add attachment to AI Chat", error);
        }
    }
}
