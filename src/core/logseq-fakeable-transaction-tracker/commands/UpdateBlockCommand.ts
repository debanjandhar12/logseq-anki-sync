import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand
} from "../types";

export class UpdateBlockCommand implements LogseqFakeableCommand {
    constructor(
        private readonly blockUuid: LogseqEntityIdentity,
        private readonly content: string
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.updateBlock(this.blockUuid, this.content);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {type: "UpdateBlock", blockUuid: this.blockUuid, content: this.content};
    }
}
