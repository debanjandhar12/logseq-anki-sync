import type {LogseqFakeableCommand} from "./types";

export class LogseqFakeableTransactionCommandQueue {
    private readonly commands: LogseqFakeableCommand[] = [];

    add(command: LogseqFakeableCommand): void {
        this.commands.push(command);
    }

    clear(): void {
        this.commands.length = 0;
    }

    getCommands(): LogseqFakeableCommand[] {
        return [...this.commands];
    }
}
