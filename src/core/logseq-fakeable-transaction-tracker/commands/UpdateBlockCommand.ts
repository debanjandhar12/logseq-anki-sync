import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    LogseqTransactionExecutor
} from "../types";

export class UpdateBlockCommand implements LogseqFakeableCommand {
    constructor(
        private readonly blockUuid: LogseqEntityIdentity,
        private readonly content: string
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.updateBlock(this.blockUuid, this.content);
    }
}
