import {LOGSEQ_DB_TRANSACTION_COMMAND_DELAY_MS} from "src/constants";
import {createLogger, LoggerCategory} from "src/logger";
import type {BaseReversibleCommand, LogseqReversibleCommand} from "./commands";
import {LogseqReversibleTransactionCommandQueue} from "./LogseqReversibleTransactionCommandQueue";
import {LogseqReversibleTransactionOperationLockManager} from "./LogseqReversibleTransactionOperationLockManager";

const logger = createLogger(LoggerCategory.MISC);

export class LogseqReversibleTransactionExecutionError extends Error {
    public constructor(
        message: string,
        public readonly tracker: LogseqReversibleTransactionTracker,
        options?: ErrorOptions
    ) {
        super(message, options);
        this.name = "LogseqReversibleTransactionExecutionError";
    }
}

export class LogseqReversibleTransactionTracker {
    private readonly commandQueue = new LogseqReversibleTransactionCommandQueue();
    private appliedCommandCount: number;
    private changedPages: string[];

    public constructor(options?: {appliedCommandCount?: number; changedPages?: string[]}) {
        this.appliedCommandCount = options?.appliedCommandCount ?? 0;
        this.changedPages = [...(options?.changedPages ?? [])];
    }

    public getCommands(): LogseqReversibleCommand[] {
        return this.commandQueue.getCommands();
    }

    public getChangedPages(): string[] {
        return [...this.changedPages];
    }

    public getAppliedCommandCount(): number {
        return this.appliedCommandCount;
    }

    public getGraphMutationCommandCount(): number {
        return this.commandQueue.getCommands().filter((command) => command.doesGraphMutations())
            .length;
    }

    public getAppliedGraphMutationCommandCount(): number {
        return this.commandQueue
            .getCommands()
            .slice(0, this.appliedCommandCount)
            .filter((command) => command.doesGraphMutations()).length;
    }

    public hasAppliedGraphMutations(): boolean {
        return this.getAppliedGraphMutationCommandCount() > 0;
    }

    // BaseReversibleCommand defines shared runtime behavior, but the tracker stores
    // LogseqReversibleCommand so every queued command is registered in the serialization codec.
    public addCommand(command: LogseqReversibleCommand | BaseReversibleCommand<any>): void {
        this.commandQueue.add(command);
    }

    public clear(): void {
        this.commandQueue.clear();
        this.appliedCommandCount = 0;
        this.changedPages = [];
    }

    public async execute(options?: {signal?: AbortSignal}) {
        return await LogseqReversibleTransactionOperationLockManager.runExclusive(async () => {
            let lastCommandResult = null;
            const commands = this.commandQueue.getCommands();

            for (let index = this.appliedCommandCount; index < commands.length; index += 1) {
                options?.signal?.throwIfAborted();
                const command = commands[index];
                if (!command) continue;
                command.resetChangedPages();
                try {
                    lastCommandResult = await command.execute();
                } catch (error) {
                    this.commandQueue.removeAt(index);
                    const causeMessage = error instanceof Error ? error.message : String(error);
                    throw new LogseqReversibleTransactionExecutionError(
                        `Failed to execute ${command.constructor.name}: ${causeMessage}`,
                        this,
                        {cause: error}
                    );
                }
                this.appliedCommandCount += 1;
                this.changedPages = [
                    ...new Set([...this.changedPages, ...command.getChangedPages()])
                ];
                await new Promise((resolve) =>
                    setTimeout(resolve, LOGSEQ_DB_TRANSACTION_COMMAND_DELAY_MS)
                );
            }

            return lastCommandResult;
        });
    }

    public async revertAppliedCommands(options?: {signal?: AbortSignal}): Promise<boolean> {
        return await LogseqReversibleTransactionOperationLockManager.runExclusive(async () => {
            options?.signal?.throwIfAborted();
            const commands = this.commandQueue.getCommands();
            while (this.appliedCommandCount > 0) {
                options?.signal?.throwIfAborted();
                const command = commands[this.appliedCommandCount - 1];
                if (!command) break;
                try {
                    await command.revert();
                } catch (error) {
                    logger.error("Failed to revert Logseq command", {
                        command: command.constructor.name,
                        error
                    });
                    throw error;
                }
                this.appliedCommandCount -= 1;
                await new Promise((resolve) =>
                    setTimeout(resolve, LOGSEQ_DB_TRANSACTION_COMMAND_DELAY_MS)
                );
            }

            return true;
        });
    }
}
