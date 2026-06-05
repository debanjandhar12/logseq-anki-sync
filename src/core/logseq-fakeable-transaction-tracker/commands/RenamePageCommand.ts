import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand
} from "../types";

export class RenamePageCommand implements LogseqFakeableCommand {
    constructor(
        private readonly pageIdentity: LogseqEntityIdentity,
        private readonly newName: string
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.renamePage(this.pageIdentity, this.newName);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {type: "RenamePage", pageUuid: this.pageIdentity, newName: this.newName};
    }
}
