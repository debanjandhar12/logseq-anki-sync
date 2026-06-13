import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {
    CreateTagOptions,
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand
} from "../types";

export class CreateTagCommand implements LogseqFakeableCommand {
    constructor(
        private readonly tagName: string,
        private readonly options?: CreateTagOptions
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.createTag(this.tagName, this.options);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {type: "CreateTag", tagName: this.tagName, options: this.options};
    }
}
