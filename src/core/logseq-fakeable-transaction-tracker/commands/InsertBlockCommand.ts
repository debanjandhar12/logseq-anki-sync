import type {
    InsertBlockOptions,
    LogseqTransactionExecutor
} from "../executor/LogseqTransactionExecutor";
import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand
} from "../types";

export class InsertBlockCommand implements LogseqFakeableCommand {
    constructor(
        private readonly parentUuid: LogseqEntityIdentity,
        private readonly content: string,
        private readonly options?: InsertBlockOptions
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.insertBlock(this.parentUuid, this.content, this.options);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {
            type: "InsertBlock",
            parentUuid: this.parentUuid,
            content: this.content,
            options: this.options
        };
    }
}
