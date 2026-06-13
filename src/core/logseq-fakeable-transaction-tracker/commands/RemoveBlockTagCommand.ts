import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand
} from "../types";

export class RemoveBlockTagCommand implements LogseqFakeableCommand {
    constructor(
        private readonly blockId: LogseqEntityIdentity,
        private readonly tagId: LogseqEntityIdentity
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.removeBlockTag(this.blockId, this.tagId);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {type: "RemoveBlockTag", blockId: this.blockId, tagId: this.tagId};
    }
}
