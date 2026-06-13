import type {
    LogseqTransactionExecutor,
    MoveBlockOptions
} from "../executor/LogseqTransactionExecutor";
import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand
} from "../types";

export class MoveBlockCommand implements LogseqFakeableCommand {
    constructor(
        private readonly srcBlockUuid: LogseqEntityIdentity,
        private readonly destBlockUuid: LogseqEntityIdentity,
        private readonly options?: MoveBlockOptions
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.moveBlock(this.srcBlockUuid, this.destBlockUuid, this.options);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {
            type: "MoveBlock",
            srcBlockUuid: this.srcBlockUuid,
            destBlockUuid: this.destBlockUuid,
            options: this.options
        };
    }
}
