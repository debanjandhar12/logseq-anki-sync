import {VIR_ENV_USER_PATH} from "src/constants";
import {JustBashWrapper} from "src/core/just-bash-wrapper/JustBashWrapper";
import {LogseqCommandDispatcher} from "src/core/just-bash-wrapper/pyodide/logseq-lib/LogseqCommandDispatcher";
import {z} from "zod";
import {LogseqReversibleTransactionTracker} from "../LogseqReversibleTransactionTracker";
import {LogseqReversibleTransactionTrackerSerializer} from "../LogseqReversibleTransactionTrackerSerializer";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";

export const BashCommandArgsSchema = z.object({
    command: z.string().describe("The bash command to execute in the read-only sandbox."),
    cwd: z
        .string()
        .optional()
        .describe(`Absolute working directory. Defaults to ${VIR_ENV_USER_PATH}.`)
});
export type BashCommandArgs = z.infer<typeof BashCommandArgsSchema>;
const BashResultSchema = z.object({
    stdout: z.string(),
    stderr: z.string(),
    exitCode: z.number().int()
});
const BashCommandStateSchema = z.object({
    status: z.enum(["new", "executed", "partially-executed"]),
    result: BashResultSchema.nullable(),
    // The existing tracker serializer validates nested data in the constructor.
    // Keeping its input unknown avoids recursive codec inference/initialization.
    childTracker: z.unknown()
});
type BashCommandState = z.infer<typeof BashCommandStateSchema>;

/** Records one shell invocation; subsequent executions replay its recorded commands, not its source. */
export class BashCommand extends BaseReversibleCommand<BashCommandState> {
    public readonly args: BashCommandArgs;
    private readonly childTracker: LogseqReversibleTransactionTracker;

    public constructor(args: BashCommandArgs, state?: BashCommandState) {
        super(
            BashCommandStateSchema.parse(
                state ?? {status: "new", result: null, childTracker: undefined}
            )
        );
        this.args = BashCommandArgsSchema.parse(args);
        this.childTracker = state
            ? LogseqReversibleTransactionTrackerSerializer.deserialize(state.childTracker)
            : new LogseqReversibleTransactionTracker();
        if (state && state.status !== "new" && !state.result) {
            throw new Error("An executed Bash command must have a recorded result");
        }
        // Older histories represented incomplete child progress as executed.
        if (
            this.commandState.status === "executed" &&
            this.childTracker.getAppliedCommandCount() !== this.childTracker.getCommands().length
        ) {
            this.commandState.status = "partially-executed";
        }
    }

    public override getCommandState(): BashCommandState {
        return {
            ...this.commandState,
            childTracker: LogseqReversibleTransactionTrackerSerializer.serialize(this.childTracker)
        };
    }

    public getCommands() {
        return this.childTracker.getCommands();
    }

    public override doesGraphMutations(): boolean {
        return this.childTracker.getGraphMutationCommandCount() > 0;
    }

    public override getChangedPages(): string[] {
        return this.childTracker.getChangedPages();
    }

    public override getChangedAssets(): string[] {
        return this.childTracker.getChangedAssets();
    }

    public async execute() {
        this.assertCanExecute();
        if (this.commandState.result) {
            // Retain the composite's ownership even if replay fails after some children succeeded.
            try {
                await this.childTracker.executeCommands();
            } finally {
                this.commandState.status =
                    this.childTracker.getAppliedCommandCount() ===
                    this.childTracker.getCommands().length
                        ? "executed"
                        : "partially-executed";
            }
            return this.commandState.result;
        }

        const dispatcher = new LogseqCommandDispatcher(this.childTracker);
        try {
            const bash = await JustBashWrapper.createExecutionInstance(() =>
                dispatcher.createBridge()
            );
            const {stdout, stderr, exitCode} = await bash.exec(this.args.command, {
                cwd: this.args.cwd
            });
            if (!Number.isInteger(exitCode)) throw new Error("Bash returned an invalid exit code");
            this.commandState.result = {stdout, stderr, exitCode};
        } catch (error) {
            this.commandState.result = {
                stdout: "",
                stderr: `bash: ${error instanceof Error ? error.message : String(error)}\n`,
                exitCode: 1
            };
        } finally {
            await dispatcher.close();
        }
        this.commandState.status = "executed";
        return this.commandState.result;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        try {
            await this.childTracker.revertCommands();
        } catch (error) {
            this.commandState.status = "partially-executed";
            throw error;
        }
        this.commandState.status = "new";
    }
}

export const BashCommandCodec = createReversibleCommandCodec({
    type: "Bash",
    argsSchema: BashCommandArgsSchema,
    commandStateSchema: BashCommandStateSchema,
    commandClass: BashCommand
});
