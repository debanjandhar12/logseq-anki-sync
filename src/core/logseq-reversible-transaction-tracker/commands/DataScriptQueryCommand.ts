import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";

export const DataScriptQueryCommandArgsSchema = z.object({
    datalogString: z.string().describe("Logseq DataScript datalog query string to execute."),
    inputs: z
        .array(z.string())
        .default([])
        .describe("Input strings to spread into the DataScript query after the query string.")
});

export type DataScriptQueryCommandArgsInput = z.input<typeof DataScriptQueryCommandArgsSchema>;
export type DataScriptQueryCommandArgs = z.output<typeof DataScriptQueryCommandArgsSchema>;

const DataScriptQueryCommandSerializedSchema = DataScriptQueryCommandArgsSchema.extend({
    type: z.literal("DataScriptQuery")
});

/**
 * Runs a Logseq DataScript query.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - none
 */
export class DataScriptQueryCommand extends BaseReversibleCommand {
    public readonly args: DataScriptQueryCommandArgs;

    public constructor(args: DataScriptQueryCommandArgsInput) {
        super();
        this.args = DataScriptQueryCommandArgsSchema.parse(args);
    }

    public async execute(): Promise<any> {
        if (this.args.inputs.length > 0) {
            return await logseq.DB.datascriptQuery(this.args.datalogString, ...this.args.inputs);
        }

        return await logseq.DB.datascriptQuery(this.args.datalogString);
    }

    public async revert(): Promise<void> {}
}

export const DataScriptQueryCommandCodec = createReversibleCommandCodec({
    type: "DataScriptQuery",
    serializedSchema: DataScriptQueryCommandSerializedSchema,
    commandSchema: z.instanceof(DataScriptQueryCommand),
    decode: (args) => new DataScriptQueryCommand(args),
    encodeData: (command) => command.args
});
