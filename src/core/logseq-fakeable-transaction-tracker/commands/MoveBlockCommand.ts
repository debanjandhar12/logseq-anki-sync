import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    LogseqTransactionExecutor
} from "../types";

export class MoveBlockCommand implements LogseqFakeableCommand {
    constructor(
        private readonly srcBlockUuid: LogseqEntityIdentity,
        private readonly destBlockUuid: LogseqEntityIdentity
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.moveBlock(this.srcBlockUuid, this.destBlockUuid);
    }
}
