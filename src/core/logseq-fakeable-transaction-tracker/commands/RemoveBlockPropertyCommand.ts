import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand
} from "../types";

export class RemoveBlockPropertyCommand implements LogseqFakeableCommand {
    constructor(
        private readonly blockUuid: LogseqEntityIdentity,
        private readonly key: string
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.removeBlockProperty(this.blockUuid, this.key);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {type: "RemoveBlockProperty", blockUuid: this.blockUuid, key: this.key};
    }
}
