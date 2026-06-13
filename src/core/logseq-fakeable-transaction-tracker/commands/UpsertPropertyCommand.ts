import type {PropertySchema} from "@logseq/libs/dist/LSPlugin";
import type {LogseqTransactionExecutor} from "../executor/LogseqTransactionExecutor";
import type {LogseqFakeableCommand, SerializedLogseqFakeableCommand} from "../types";

export class UpsertPropertyCommand implements LogseqFakeableCommand {
    constructor(
        private readonly key: string,
        private readonly schema?: Partial<PropertySchema>,
        private readonly options?: {name?: string}
    ) {}

    async execute(executor: LogseqTransactionExecutor): Promise<void> {
        await executor.upsertProperty(this.key, this.schema, this.options);
    }

    toJSON(): SerializedLogseqFakeableCommand {
        return {
            type: "UpsertProperty",
            key: this.key,
            schema: this.schema,
            options: this.options
        };
    }
}
