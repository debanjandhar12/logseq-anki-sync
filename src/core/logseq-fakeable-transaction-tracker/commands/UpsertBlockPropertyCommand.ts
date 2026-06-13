import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand
} from "../types";

export class UpsertBlockPropertyCommand implements LogseqFakeableCommand {
    constructor(
        private readonly blockUuid: LogseqEntityIdentity,
        private readonly key: string,
        private readonly value: any,
        private readonly options?: Partial<{reset: boolean}>
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.upsertBlockProperty(this.blockUuid, this.key, this.value, this.options);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {
            type: "UpsertBlockProperty",
            blockUuid: this.blockUuid,
            key: this.key,
            value: this.value,
            options: this.options
        };
    }
}
