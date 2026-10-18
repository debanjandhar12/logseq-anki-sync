import type {LogseqReversibleTransactionResult} from "../types";

export type ReversibleCommandStatus = "new" | "executed" | "partially-executed";

export abstract class BaseReversibleCommand<
    CommandState extends {status: ReversibleCommandStatus}
> {
    protected changedPages: string[] = [];
    protected changedAssets: string[] = [];
    public abstract readonly args: unknown;

    protected constructor(protected commandState: CommandState) {}

    public abstract execute(): Promise<LogseqReversibleTransactionResult>;

    public abstract revert(): Promise<void>;

    public doesGraphMutations(): boolean {
        return true;
    }

    public getCommandState(): CommandState {
        return {...this.commandState};
    }

    protected assertCanExecute(): void {
        if (this.commandState.status === "partially-executed") {
            throw new Error("Command is partially executed. Revert it before executing again.");
        }
        if (this.commandState.status === "executed") {
            throw new Error("Command has already been executed");
        }
    }

    protected assertCanRevert(): void {
        if (this.commandState.status === "new") {
            throw new Error("Command has not been executed");
        }
    }

    public getChangedPages(): string[] {
        return [...this.changedPages];
    }

    public resetChangedPages(): void {
        this.changedPages = [];
    }

    public getChangedAssets(): string[] {
        return [...this.changedAssets];
    }

    public resetChangedAssets(): void {
        this.changedAssets = [];
    }
}
