import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    LogseqTransactionExecutor
} from "../types";

export class RenamePageCommand implements LogseqFakeableCommand {
    constructor(
        private readonly pageIdentity: LogseqEntityIdentity,
        private readonly newName: string
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.renamePage(this.pageIdentity, this.newName);
    }
}
