import {createLogger, LoggerCategory} from "src/logger";
import type {BaseReversibleCommand, LogseqReversibleCommand} from "./commands";
import {LogseqReversibleTransactionCommandQueue} from "./LogseqReversibleTransactionCommandQueue";
import {LogseqReversibleTransactionOperationLockManager} from "./LogseqReversibleTransactionOperationLockManager";

const logger = createLogger(LoggerCategory.MISC);

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
            const initialAppliedCommandCount = this.appliedCommandCount;
            const initialChangedPages = [...this.changedPages];
            const commands = this.commandQueue.getCommands();

            try {
                for (let index = this.appliedCommandCount; index < commands.length; index += 1) {
                    options?.signal?.throwIfAborted();
                    const command = commands[index];
                    if (!command) continue;
                    command.resetChangedPages();
                    lastCommandResult = await command.execute();
                    this.appliedCommandCount += 1;
                    this.changedPages = [
                        ...new Set([...this.changedPages, ...command.getChangedPages()])
                    ];
                    await new Promise((resolve) => setTimeout(resolve, 320));
                }
            } catch (error) {
                while (this.appliedCommandCount > initialAppliedCommandCount) {
                    const command = commands[this.appliedCommandCount - 1];
                    if (!command) break;
                    try {
                        await command.revert();
                    } catch (revertError) {
                        logger.error("Failed to roll back command after execute failure", {
                            command: command.constructor.name,
                            error: revertError
                        });
                    }
                    this.appliedCommandCount -= 1;
                    await new Promise((resolve) => setTimeout(resolve, 320));
                }
                this.changedPages = initialChangedPages;
                this.commandQueue.truncate(this.appliedCommandCount);
                throw error;
            }

            return lastCommandResult;
        });
    }

    public async revertImmediately(options?: {signal?: AbortSignal}): Promise<boolean> {
        return await LogseqReversibleTransactionOperationLockManager.runExclusive(async () => {
            options?.signal?.throwIfAborted();
            const commands = this.commandQueue.getCommands();
            const revertErrors: unknown[] = [];
            while (this.appliedCommandCount > 0) {
                options?.signal?.throwIfAborted();
                const command = commands[this.appliedCommandCount - 1];
                if (!command) break;
                try {
                    await command.revert();
                } catch (error) {
                    revertErrors.push(error);
                    logger.error("Failed to revert Logseq command", {
                        command: command.constructor.name,
                        error
                    });
                }
                this.appliedCommandCount -= 1;
            }

            if (revertErrors.length > 0) {
                throw new AggregateError(
                    revertErrors,
                    "Failed to revert one or more Logseq commands"
                );
            }

            return true;
        });
    }
}
