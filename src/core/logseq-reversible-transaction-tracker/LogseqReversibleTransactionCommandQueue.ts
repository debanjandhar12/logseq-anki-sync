import type {LogseqReversibleCommand} from "./commands";

export class LogseqReversibleTransactionCommandQueue {
    private readonly commands: LogseqReversibleCommand[] = [];

    public add(command: LogseqReversibleCommand): void {
        this.commands.push(command);
    }

    public clear(): void {
        this.commands.length = 0;
    }

    public getCommands(): LogseqReversibleCommand[] {
        return [...this.commands];
    }
}
