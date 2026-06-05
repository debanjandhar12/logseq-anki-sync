import {DeterminesticUUIDGenerator} from "./DeterminesticUUIDGenerator";
import {InMemoryExecutor} from "./executor/InMemoryExecutor";
import {LogseqExecutor} from "./executor/LogseqExecutor";
import {LogseqFakeableTransactionCommandQueue} from "./LogseqFakeableTransactionCommandQueue";
import {LogseqFakeableTransactionCommandSerializer} from "./LogseqFakeableTransactionCommandSerializer";
import type {LogseqFakeableCommand, SerializedLogseqFakeableTransactionTracker} from "./types";

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

    private UUID_GENERATION_SEED = logseq.Editor.newUUID();

    public addCommand(command: LogseqFakeableCommand): void {
        this.commandQueue.add(command);
    }

    public clear(): void {
        this.commandQueue.clear();
        this.UUID_GENERATION_SEED = logseq.Editor.newUUID();
    }

    public toJSON(): SerializedLogseqFakeableTransactionTracker {
        return {
            uuidGenerationSeed: this.UUID_GENERATION_SEED,
            commands: this.commandQueue
                .getCommands()
                .map(LogseqFakeableTransactionCommandSerializer.serialize)
        };
    }

    static fromJSON(
        json: SerializedLogseqFakeableTransactionTracker
    ): LogseqFakeableTransactionTracker {
        const tracker = new LogseqFakeableTransactionTracker();
        tracker.UUID_GENERATION_SEED = json.uuidGenerationSeed;
        for (const command of json.commands) {
            tracker.addCommand(LogseqFakeableTransactionCommandSerializer.deserialize(command));
        }

        return tracker;
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
