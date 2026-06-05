import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand
} from "../types";

export class MoveBlockCommand implements LogseqFakeableCommand {
    constructor(
        private readonly srcBlockUuid: LogseqEntityIdentity,
        private readonly destBlockUuid: LogseqEntityIdentity
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.moveBlock(this.srcBlockUuid, this.destBlockUuid);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {
            type: "MoveBlock",
            srcBlockUuid: this.srcBlockUuid,
            destBlockUuid: this.destBlockUuid
        };
    }
}
