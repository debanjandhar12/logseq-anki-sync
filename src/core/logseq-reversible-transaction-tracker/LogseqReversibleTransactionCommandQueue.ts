import type {BaseReversibleCommand, LogseqReversibleCommand} from "./commands";

export class LogseqReversibleTransactionCommandQueue {
    private readonly commands: BaseReversibleCommand<any>[] = [];

    public add(command: BaseReversibleCommand<any>): void {
        this.commands.push(command);
    }

    public clear(): void {
        this.commands.length = 0;
    }

    public truncate(length: number): void {
        this.commands.length = Math.max(0, length);
    }

    public removeAt(index: number): void {
        if (index < 0 || index >= this.commands.length) return;
        this.commands.splice(index, 1);
    }

    public getCommands(): LogseqReversibleCommand[] {
        return [...this.commands] as LogseqReversibleCommand[];
    }
}
