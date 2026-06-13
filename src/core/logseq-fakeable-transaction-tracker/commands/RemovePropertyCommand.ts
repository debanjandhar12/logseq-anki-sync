import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {LogseqFakeableCommand, SerializedLogseqFakeableCommand} from "../types";

export class RemovePropertyCommand implements LogseqFakeableCommand {
    constructor(private readonly key: string) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.removeProperty(this.key);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {type: "RemoveProperty", key: this.key};
    }
}
