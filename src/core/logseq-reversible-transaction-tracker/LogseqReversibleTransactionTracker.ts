import type {LogseqReversibleCommand} from "./commands";
import {LogseqReversibleTransactionCommandQueue} from "./LogseqReversibleTransactionCommandQueue";

export class LogseqReversibleTransactionTracker {
    private readonly commandQueue = new LogseqReversibleTransactionCommandQueue();
    private changedPages: string[] = [];

    public constructor() {}

    public getCommands(): LogseqReversibleCommand[] {
        return this.commandQueue.getCommands();
    }

    public getChangedPages(): string[] {
        return [...this.changedPages];
    }

    // BaseReversibleCommand defines shared runtime behavior, but the tracker stores
    // LogseqReversibleCommand so every queued command is registered in the serialization codec.
    public addCommand(command: LogseqReversibleCommand): void {
        this.commandQueue.add(command);
    }

    public clear(): void {
        this.commandQueue.clear();
        this.changedPages = [];
    }

    public async execute() {
        this.changedPages = [];
        let lastCommandResult = null;
        const executedCommands: LogseqReversibleCommand[] = [];

        try {
            for (const command of this.commandQueue.getCommands()) {
                command.resetChangedPages();
                lastCommandResult = await command.execute();
                executedCommands.push(command);
                this.changedPages = [...this.changedPages, ...command.getChangedPages()];
                // Add slight delay to ensure the command is actually commited before continuing
                await new Promise((resolve) => setTimeout(resolve, 120));
            }
        } catch (error) {
            for (const command of executedCommands.reverse()) {
                await command.revert();
                // Add slight delay to ensure the command is actually commited before continuing
                await new Promise((resolve) => setTimeout(resolve, 120));
            }
            throw error;
        }

        return lastCommandResult;
    }

    public async revert(): Promise<boolean> {
        for (const command of [...this.commandQueue.getCommands()].reverse()) {
            await command.revert();
        }

        return true;
    }
}
