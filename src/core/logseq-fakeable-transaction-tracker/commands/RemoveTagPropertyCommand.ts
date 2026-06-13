import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand
} from "../types";

export class RemoveTagPropertyCommand implements LogseqFakeableCommand {
    constructor(
        private readonly tagId: LogseqEntityIdentity,
        private readonly propertyIdOrName: LogseqEntityIdentity
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.removeTagProperty(this.tagId, this.propertyIdOrName);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {
            type: "RemoveTagProperty",
            tagId: this.tagId,
            propertyIdOrName: this.propertyIdOrName
        };
    }
}
