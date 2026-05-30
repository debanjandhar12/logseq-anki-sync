import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    LogseqTransactionExecutor,
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
        return {type: "RenamePage", pageIdentity: this.pageIdentity, newName: this.newName};
    }
}
