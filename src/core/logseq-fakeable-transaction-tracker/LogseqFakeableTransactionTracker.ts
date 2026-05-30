import {
    CreatePageCommand,
    DeletePageCommand,
    InsertBlockCommand,
    MoveBlockCommand,
    RenamePageCommand,
    UpdateBlockCommand
} from "./commands";
import {InMemoryExecutor} from "./executor/InMemoryExecutor";
import {LogseqExecutor} from "./executor/LogseqExecutor";
import {LogseqFakeableTransactionCommandQueue} from "./LogseqFakeableTransactionCommandQueue";
import type {
    LogseqFakeableCommand,
    SerializedLogseqFakeableCommand,
    SerializedLogseqFakeableTransactionTracker
} from "./types";

export class LogseqFakeableTransactionTracker {
    private readonly commandQueue = new LogseqFakeableTransactionCommandQueue();

    public addCommand(command: LogseqFakeableCommand): void {
        this.commandQueue.add(command);
    }

    public clear(): void {
        this.commandQueue.clear();
    }

    public toJSON(): SerializedLogseqFakeableTransactionTracker {
        return {
            commands: this.commandQueue.getCommands().map(serializeCommand)
        };
    }

    static fromJSON(json: SerializedLogseqFakeableTransactionTracker): LogseqFakeableTransactionTracker {
        const tracker = new LogseqFakeableTransactionTracker();
        for (const command of json.commands) {
            tracker.addCommand(deserializeCommand(command));
        }

        return tracker;
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

function serializeCommand(command: LogseqFakeableCommand): SerializedLogseqFakeableCommand {
    if ("toJSON" in command && typeof command.toJSON === "function") {
        return command.toJSON() as SerializedLogseqFakeableCommand;
    }

    throw new Error(`Unsupported Logseq transaction command: ${command.constructor.name}`);
}

function deserializeCommand(command: SerializedLogseqFakeableCommand): LogseqFakeableCommand {
    switch (command.type) {
        case "CreatePage":
            return new CreatePageCommand(command.pageName, command.properties);
        case "DeletePage":
            return new DeletePageCommand(command.pageIdentity);
        case "InsertBlock":
            return new InsertBlockCommand(command.parentUuid, command.content);
        case "MoveBlock":
            return new MoveBlockCommand(command.srcBlockUuid, command.destBlockUuid);
        case "RenamePage":
            return new RenamePageCommand(command.pageIdentity, command.newName);
        case "UpdateBlock":
            return new UpdateBlockCommand(command.blockUuid, command.content);
    }
}
