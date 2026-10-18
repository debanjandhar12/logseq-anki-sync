import AwaitLock from "await-lock";
import type {BaseReversibleCommand} from "src/core/logseq-reversible-transaction-tracker/commands/BaseReversibleCommand";
import {CreatePageCommand} from "src/core/logseq-reversible-transaction-tracker/commands/CreatePageCommand";
import {DeleteBlockCommand} from "src/core/logseq-reversible-transaction-tracker/commands/DeleteBlockCommand";
import {DeleteCommandFileCommand} from "src/core/logseq-reversible-transaction-tracker/commands/DeleteCommandFileCommand";
import {DeletePageCommand} from "src/core/logseq-reversible-transaction-tracker/commands/DeletePageCommand";
import {DeleteSkillFileCommand} from "src/core/logseq-reversible-transaction-tracker/commands/DeleteSkillFileCommand";
import {InsertBlockCommand} from "src/core/logseq-reversible-transaction-tracker/commands/InsertBlockCommand";
import {PutAssetFileCommand} from "src/core/logseq-reversible-transaction-tracker/commands/PutAssetFileCommand";
import {PutCommandFileCommand} from "src/core/logseq-reversible-transaction-tracker/commands/PutCommandFileCommand";
import {PutSkillFileCommand} from "src/core/logseq-reversible-transaction-tracker/commands/PutSkillFileCommand";
import {ReadAssetFileCommand} from "src/core/logseq-reversible-transaction-tracker/commands/ReadAssetFileCommand";
import {ReadCommandFileCommand} from "src/core/logseq-reversible-transaction-tracker/commands/ReadCommandFileCommand";
import {ReadSkillFileCommand} from "src/core/logseq-reversible-transaction-tracker/commands/ReadSkillFileCommand";
import type {LogseqReversibleTransactionTracker} from "src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionTracker";
import type {LogseqLibBridge} from "./types";

// Used to build logseq_lib of pyodide (getLogseqLibModule.ts).
// This contains code to register commands and dispatch them.
export class LogseqCommandDispatcher {
    private readonly commands = new Map<
        string,
        (args: Record<string, unknown>) => BaseReversibleCommand<any>
    >();
    private readonly lock = new AwaitLock();
    private readonly workers = new Set<() => Promise<void>>();
    private closed = false;

    public constructor(private readonly tracker: LogseqReversibleTransactionTracker) {
        this.addCommand("create_page", CreatePageCommand);
        this.addCommand("delete_page", DeletePageCommand);
        this.addCommand("insert_block", InsertBlockCommand);
        this.addCommand("delete_block", DeleteBlockCommand);
        this.addCommand("read_raw_skill", ReadSkillFileCommand);
        this.addCommand("read_command_file", ReadCommandFileCommand);
        this.addCommand("read_asset", ReadAssetFileCommand);
        this.addCommand("save_skill", PutSkillFileCommand);
        this.addCommand("save_command_file", PutCommandFileCommand);
        this.addCommand("save_asset", PutAssetFileCommand);
        this.addCommand("delete_skill", DeleteSkillFileCommand);
        this.addCommand("delete_command_file", DeleteCommandFileCommand);
    }

    public addCommand<Args, Command extends BaseReversibleCommand<any>>(
        name: string,
        CommandClass: new (args: Args) => Command
    ): void {
        if (this.commands.has(name)) throw new Error(`Duplicate Logseq method: ${name}`);
        // Command constructors validate unknown input using their existing schemas.
        this.commands.set(name, (args) => new CommandClass(args as Args));
    }

    /** Each Python worker gets a revocable bridge; closing waits for its started host work. */
    public createBridge(): {bridge: LogseqLibBridge; close: () => Promise<void>} {
        if (this.closed) throw new Error("Logseq execution has ended");
        let closed = false;
        const pending = new Set<Promise<unknown>>();
        const bridge: LogseqLibBridge = {
            methods: [...this.commands.keys()],
            call: (method, args) => {
                const operation = this.execute(method, args, () => closed || this.closed);
                pending.add(operation);
                void operation.then(
                    () => pending.delete(operation),
                    () => pending.delete(operation)
                );
                return operation;
            }
        };
        const close = async () => {
            closed = true;
            await Promise.allSettled([...pending]);
            this.workers.delete(close);
        };
        this.workers.add(close);
        return {bridge, close};
    }

    public async close(): Promise<void> {
        this.closed = true;
        await Promise.all([...this.workers].map((close) => close()));
    }

    private async execute(method: string, args: Record<string, unknown>, isClosed: () => boolean) {
        await this.lock.acquireAsync();
        try {
            if (isClosed()) throw new Error("Logseq execution has ended");
            const createCommand = this.commands.get(method);
            if (!createCommand) throw new Error(`Unknown Logseq method: ${method}`);
            if (!args || typeof args !== "object" || Array.isArray(args)) {
                throw new Error("Logseq methods require an argument dictionary");
            }
            const command = createCommand(args);
            this.tracker.addCommand(command);
            // The enclosing BashCommand already owns the global tracker lock.
            return await this.tracker.executeCommands();
        } finally {
            this.lock.release();
        }
    }
}
