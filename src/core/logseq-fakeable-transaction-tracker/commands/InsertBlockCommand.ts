import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    LogseqTransactionExecutor
} from "../types";

export class InsertBlockCommand implements LogseqFakeableCommand {
    constructor(
        private readonly parentUuid: LogseqEntityIdentity,
        private readonly content: string
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.insertBlock(this.parentUuid, this.content);
    }
}
