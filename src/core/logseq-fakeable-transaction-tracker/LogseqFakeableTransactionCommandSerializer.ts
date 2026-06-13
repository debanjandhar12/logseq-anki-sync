import {
    CreatePageCommand,
    DeletePageCommand,
    InsertBlockCommand,
    MoveBlockCommand,
    RenamePageCommand,
    UpdateBlockCommand
} from "./commands";
import type {LogseqFakeableCommand, SerializedLogseqFakeableCommand} from "./types";

export class LogseqFakeableTransactionCommandSerializer {
    static serialize(command: LogseqFakeableCommand): SerializedLogseqFakeableCommand {
        if ("toJSON" in command && typeof command.toJSON === "function") {
            return command.toJSON() as SerializedLogseqFakeableCommand;
        }

        throw new Error(`Unsupported Logseq transaction command: ${command.constructor.name}`);
    }

    static deserialize(command: SerializedLogseqFakeableCommand): LogseqFakeableCommand {
        switch (command.type) {
            case "CreatePage":
                return new CreatePageCommand(command.pageName, command.properties);
            case "DeletePage":
                return new DeletePageCommand(command.pageUuid);
            case "InsertBlock":
                return new InsertBlockCommand(command.parentUuid, command.content, command.options);
            case "MoveBlock":
                return new MoveBlockCommand(
                    command.srcBlockUuid,
                    command.destBlockUuid,
                    command.options
                );
            case "RenamePage":
                return new RenamePageCommand(command.pageUuid, command.newName);
            case "UpdateBlock":
                return new UpdateBlockCommand(command.blockUuid, command.content);
        }
    }
}
