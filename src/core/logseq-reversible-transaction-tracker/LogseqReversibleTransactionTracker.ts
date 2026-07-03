import type {PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {v4 as uuidv4} from "uuid";
import type {LogseqReversibleCommand} from "./commands";
import {DeterministicUUIDGenerator} from "./DeterministicUUIDGenerator";
import {LogseqReversibleTransactionCommandQueue} from "./LogseqReversibleTransactionCommandQueue";

export class LogseqReversibleTransactionTracker {
    private readonly commandQueue = new LogseqReversibleTransactionCommandQueue();
    private UUID_GENERATION_SEED: string;
    private changedPages: string[] = [];

    public constructor(UUID_GENERATION_SEED?: string) {
        this.UUID_GENERATION_SEED = UUID_GENERATION_SEED ?? uuidv4();
    }

    public getUUIDGenerationSeed(): string {
        return this.UUID_GENERATION_SEED;
    }

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
        this.UUID_GENERATION_SEED = uuidv4();
    }

    public async execute() {
        this.changedPages = [];
        const deterministicUUIDGenerator = new DeterministicUUIDGenerator(
            this.UUID_GENERATION_SEED
        );
        let lastCommandResult = null;
        const executedCommands: LogseqReversibleCommand[] = [];

        try {
            for (const command of this.commandQueue.getCommands()) {
                command.resetChangedPages();
                lastCommandResult = await command.execute(deterministicUUIDGenerator);
                executedCommands.push(command);
                this.changedPages = [...this.changedPages, ...command.getChangedPages()];
            }
        } catch (error) {
            for (const command of executedCommands.reverse()) await command.revert();
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
