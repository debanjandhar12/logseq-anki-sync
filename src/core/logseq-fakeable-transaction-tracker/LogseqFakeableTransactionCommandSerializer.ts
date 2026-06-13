import {
    AddBlockTagCommand,
    AddTagExtendsCommand,
    AddTagPropertyCommand,
    CreatePageCommand,
    CreateTagCommand,
    DeletePageCommand,
    InsertBlockCommand,
    MoveBlockCommand,
    RemoveBlockPropertyCommand,
    RemoveBlockTagCommand,
    RemovePropertyCommand,
    RemoveTagExtendsCommand,
    RemoveTagPropertyCommand,
    RenamePageCommand,
    UpdateBlockCommand,
    UpsertBlockPropertyCommand,
    UpsertPropertyCommand
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
            case "UpsertProperty":
                return new UpsertPropertyCommand(command.key, command.schema, command.options);
            case "RemoveProperty":
                return new RemovePropertyCommand(command.key);
            case "UpsertBlockProperty":
                return new UpsertBlockPropertyCommand(
                    command.blockUuid,
                    command.key,
                    command.value,
                    command.options
                );
            case "RemoveBlockProperty":
                return new RemoveBlockPropertyCommand(command.blockUuid, command.key);
            case "CreateTag":
                return new CreateTagCommand(command.tagName, command.options);
            case "AddTagProperty":
                return new AddTagPropertyCommand(command.tagId, command.propertyIdOrName);
            case "RemoveTagProperty":
                return new RemoveTagPropertyCommand(command.tagId, command.propertyIdOrName);
            case "AddTagExtends":
                return new AddTagExtendsCommand(command.tagId, command.parentTagIdOrName);
            case "RemoveTagExtends":
                return new RemoveTagExtendsCommand(command.tagId, command.parentTagIdOrName);
            case "AddBlockTag":
                return new AddBlockTagCommand(command.blockId, command.tagId);
            case "RemoveBlockTag":
                return new RemoveBlockTagCommand(command.blockId, command.tagId);
        }
    }
}
