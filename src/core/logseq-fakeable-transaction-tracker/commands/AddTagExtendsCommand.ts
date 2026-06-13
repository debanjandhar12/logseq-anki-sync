import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand
} from "../types";

export class AddTagExtendsCommand implements LogseqFakeableCommand {
    constructor(
        private readonly tagId: LogseqEntityIdentity,
        private readonly parentTagIdOrName: LogseqEntityIdentity
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.addTagExtends(this.tagId, this.parentTagIdOrName);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {
            type: "AddTagExtends",
            tagId: this.tagId,
            parentTagIdOrName: this.parentTagIdOrName
        };
    }
}
