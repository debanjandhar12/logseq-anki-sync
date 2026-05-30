import {InMemoryExecutor} from "./executor/InMemoryExecutor";
import {LogseqExecutor} from "./executor/LogseqExecutor";
import {LogseqFakeableTransactionCommandQueue} from "./LogseqFakeableTransactionCommandQueue";
import type {LogseqFakeableCommand} from "./types";

export class LogseqFakeableTransactionTracker {
    private readonly commandQueue = new LogseqFakeableTransactionCommandQueue();

    public addCommand(command: LogseqFakeableCommand): void {
        this.commandQueue.add(command);
    }

    public clear(): void {
        this.commandQueue.clear();
    }

    public async executeInTheInMemoryDB(): Promise<InMemoryExecutor> {
        const executor = new InMemoryExecutor();
        for (const command of this.commandQueue.getCommands()) {
            await command.execute(executor);
        }

        return executor;
    }

    public async executeInLogseq(): Promise<boolean> {
        const executor = new LogseqExecutor();
        for (const command of this.commandQueue.getCommands()) {
            await command.execute(executor);
        }

        return true;
    }
}
