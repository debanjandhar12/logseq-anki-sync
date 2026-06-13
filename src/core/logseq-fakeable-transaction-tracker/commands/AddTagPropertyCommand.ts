import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand
} from "../types";

export class AddTagPropertyCommand implements LogseqFakeableCommand {
    constructor(
        private readonly tagId: LogseqEntityIdentity,
        private readonly propertyIdOrName: LogseqEntityIdentity
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.addTagProperty(this.tagId, this.propertyIdOrName);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {type: "AddTagProperty", tagId: this.tagId, propertyIdOrName: this.propertyIdOrName};
    }
}
