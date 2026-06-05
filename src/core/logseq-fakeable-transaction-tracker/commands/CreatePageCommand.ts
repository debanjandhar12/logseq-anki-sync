import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {LogseqFakeableCommand, SerializedLogseqFakeableCommand} from "../types";

export class CreatePageCommand implements LogseqFakeableCommand {
    constructor(
        private readonly pageName: string,
        private readonly properties?: Record<string, any>
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.createPage(this.pageName, this.properties);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {type: "CreatePage", pageName: this.pageName, properties: this.properties};
    }
}
