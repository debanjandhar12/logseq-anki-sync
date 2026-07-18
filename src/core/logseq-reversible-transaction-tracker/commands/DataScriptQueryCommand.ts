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

export const DataScriptQueryCommandStateSchema = z.object({
    status: z.enum(["new", "executed"])
});
export type DataScriptQueryCommandState = z.output<typeof DataScriptQueryCommandStateSchema>;

/**
 * Runs a Logseq DataScript query.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - none
 */
export class DataScriptQueryCommand extends BaseReversibleCommand<DataScriptQueryCommandState> {
    public readonly args: DataScriptQueryCommandArgs;

    public constructor(
        args: DataScriptQueryCommandArgsInput,
        commandState?: DataScriptQueryCommandState
    ) {
        super(DataScriptQueryCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = DataScriptQueryCommandArgsSchema.parse(args);
    }

    public async execute(): Promise<any> {
        this.assertCanExecute();
        let result: unknown;
        if (this.args.inputs.length > 0) {
            result = await logseq.DB.datascriptQuery(this.args.datalogString, ...this.args.inputs);
        } else {
            result = await logseq.DB.datascriptQuery(this.args.datalogString);
        }

        this.commandState.status = "executed";
        return result;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        this.commandState.status = "new";
    }

    public override isGraphMutation(): boolean {
        return false;
    }
}

export const DataScriptQueryCommandCodec = createReversibleCommandCodec({
    type: "DataScriptQuery",
    argsSchema: DataScriptQueryCommandArgsSchema,
    commandStateSchema: DataScriptQueryCommandStateSchema,
    commandClass: DataScriptQueryCommand
});
