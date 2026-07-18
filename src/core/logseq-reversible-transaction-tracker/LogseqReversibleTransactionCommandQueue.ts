import type {BaseReversibleCommand, LogseqReversibleCommand} from "./commands";

export class LogseqReversibleTransactionCommandQueue {
    private readonly commands: BaseReversibleCommand<any>[] = [];

    public add(command: BaseReversibleCommand<any>): void {
        this.commands.push(command);
    }

    public clear(): void {
        this.commands.length = 0;
    }

    public getCommands(): LogseqReversibleCommand[] {
        return [...this.commands] as LogseqReversibleCommand[];
    }
}
