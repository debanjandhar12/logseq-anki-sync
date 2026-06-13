import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand
} from "../types";

export class RemoveTagExtendsCommand implements LogseqFakeableCommand {
    constructor(
        private readonly tagId: LogseqEntityIdentity,
        private readonly parentTagIdOrName: LogseqEntityIdentity
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.removeTagExtends(this.tagId, this.parentTagIdOrName);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {
            type: "RemoveTagExtends",
            tagId: this.tagId,
            parentTagIdOrName: this.parentTagIdOrName
        };
    }
}
