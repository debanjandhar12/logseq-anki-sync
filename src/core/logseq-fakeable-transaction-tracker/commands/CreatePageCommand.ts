import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {LogseqFakeableCommand, SerializedLogseqFakeableCommand} from "../types";

export class CreatePageCommand implements LogseqFakeableCommand {
    constructor(private readonly pageName: string) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.createPage(this.pageName);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {type: "CreatePage", pageName: this.pageName};
    }
}
