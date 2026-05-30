import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    LogseqTransactionExecutor
} from "../types";

export class DeletePageCommand implements LogseqFakeableCommand {
    constructor(private readonly pageIdentity: LogseqEntityIdentity) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.deletePage(this.pageIdentity);
    }
}
