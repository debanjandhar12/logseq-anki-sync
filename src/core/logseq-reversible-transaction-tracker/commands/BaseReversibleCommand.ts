import type {LogseqReversibleTransactionResult} from "../types";

export abstract class BaseReversibleCommand {
    protected changedPages: string[] = [];

    public abstract execute(): Promise<LogseqReversibleTransactionResult>;

    public abstract revert(): Promise<void>;

    public getChangedPages(): string[] {
        return [...this.changedPages];
    }

    public resetChangedPages(): void {
        this.changedPages = [];
    }
}
