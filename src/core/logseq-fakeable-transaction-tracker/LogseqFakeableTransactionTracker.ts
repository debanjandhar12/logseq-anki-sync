import {DeterminesticUUIDGenerator} from "./DeterminesticUUIDGenerator";
import {InMemoryExecutor} from "./executor/InMemoryExecutor";
import {LogseqExecutor} from "./executor/LogseqExecutor";
import {LogseqFakeableTransactionCommandQueue} from "./LogseqFakeableTransactionCommandQueue";
import type {LogseqFakeableCommand} from "./types";
import {v4 as uuidv4} from "uuid";

function getThrownValueMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    if (error === null || error === undefined) return "Unknown error";

    if (typeof error === "object") {
        const errorRecord = error as Record<string, unknown>;
        const message = errorRecord.message ?? errorRecord.error ?? errorRecord.reason;
        if (typeof message === "string" && message.trim().length > 0) {
            return message;
        }

        try {
            return JSON.stringify(error);
        } catch {
            return String(error);
        }
    }

    return String(error);
}

export class LogseqFakeableTransactionTracker {
    private readonly commandQueue = new LogseqFakeableTransactionCommandQueue();

    private UUID_GENERATION_SEED = null;

    constructor() {
        this.UUID_GENERATION_SEED = uuidv4();
    }

    public getUuidGenerationSeed(): string {
        return this.UUID_GENERATION_SEED;
    }

    public setUuidGenerationSeed(uuidGenerationSeed: string): void {
        this.UUID_GENERATION_SEED = uuidGenerationSeed;
    }

    public getCommands(): LogseqFakeableCommand[] {
        return this.commandQueue.getCommands();
    }

    public addCommand(command: LogseqFakeableCommand): void {
        this.commandQueue.add(command);
    }

    public clear(): void {
        this.commandQueue.clear();
        this.UUID_GENERATION_SEED = uuidv4();
    }

    public async executeInTheInMemoryDB(): Promise<InMemoryExecutor> {
        const executor = new InMemoryExecutor(
            new DeterminesticUUIDGenerator(this.UUID_GENERATION_SEED)
        );
        for (const [index, command] of this.commandQueue.getCommands().entries()) {
            try {
                await command.execute(executor);
            } catch (error) {
                throw new Error(
                    `Failed to execute in-memory Logseq transaction command ${index + 1} (${command.constructor.name}): ${getThrownValueMessage(error)}`,
                    {cause: error}
                );
            }
        }

        return executor;
    }

    public async executeInLogseq(): Promise<LogseqExecutor> {
        const executor = new LogseqExecutor(
            new DeterminesticUUIDGenerator(this.UUID_GENERATION_SEED)
        );
        for (const [index, command] of this.commandQueue.getCommands().entries()) {
            try {
                await command.execute(executor);
            } catch (error) {
                throw new Error(
                    `Failed to commit Logseq transaction command ${index + 1} (${command.constructor.name}): ${getThrownValueMessage(error)}`,
                    {cause: error}
                );
            }
        }

        return executor;
    }
}
