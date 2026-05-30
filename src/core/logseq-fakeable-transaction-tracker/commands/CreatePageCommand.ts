import type {LogseqFakeableCommand, LogseqTransactionExecutor} from "../types";

export class CreatePageCommand implements LogseqFakeableCommand {
    constructor(
        private readonly pageName: string,
        private readonly properties?: Record<string, any>
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.createPage(this.pageName, this.properties);
    }
}
