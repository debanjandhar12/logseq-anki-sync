import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {
    LogseqEntityIdentity,
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand
} from "../types";

export class InsertBlockCommand implements LogseqFakeableCommand {
    constructor(
        private readonly parentUuid: LogseqEntityIdentity,
        private readonly content: string
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.insertBlock(this.parentUuid, this.content);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {type: "InsertBlock", parentUuid: this.parentUuid, content: this.content};
    }
}
