import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    LogseqTransactionExecutor,
    SerializedLogseqFakeableCommand
} from "../types";

export class DeletePageCommand implements LogseqFakeableCommand {
    constructor(private readonly pageIdentity: LogseqEntityIdentity) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.deletePage(this.pageIdentity);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {type: "DeletePage", pageUuid: this.pageIdentity};
    }
}
