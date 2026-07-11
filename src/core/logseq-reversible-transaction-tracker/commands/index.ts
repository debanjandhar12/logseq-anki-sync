import {z} from "zod";
import {AddPropertyToTagPageCommandCodec} from "./AddPropertyToTagPageCommand";
import {AddTagToBlockCommandCodec} from "./AddTagToBlockCommand";
import {CreatePageCommandCodec} from "./CreatePageCommand";
import {CreateTagPageCommandCodec} from "./CreateTagPageCommand";
import {DataScriptQueryCommandCodec} from "./DataScriptQueryCommand";
import {DeleteBlockCommandCodec} from "./DeleteBlockCommand";
import {DeletePageCommandCodec} from "./DeletePageCommand";
import {DeletePropertyFromBlockCommandCodec} from "./DeletePropertyFromBlockCommand";
import {InsertBlockCommandCodec} from "./InsertBlockCommand";
import {MoveBlockCommandCodec} from "./MoveBlockCommand";
import {ReadBlockCommandCodec} from "./ReadBlockCommand";
import {RemovePropertyFromTagPageCommandCodec} from "./RemovePropertyFromTagPageCommand";
import {RemoveTagFromBlockCommandCodec} from "./RemoveTagFromBlockCommand";
import {RenamePageCommandCodec} from "./RenamePageCommand";
import {RestorePageCommandCodec} from "./RestorePageCommand";
import {TextSearchCommandCodec} from "./TextSearchCommand";
import {UpdateBlockCommandCodec} from "./UpdateBlockCommand";
import {UpsertPropertyPageCommandCodec} from "./UpsertPropertyPageCommand";
import {UpsertPropertyToBlockCommandCodec} from "./UpsertPropertyToBlockCommand";

export {
    AddPropertyToTagPageCommand,
    type AddPropertyToTagPageCommandArgs,
    type AddPropertyToTagPageCommandArgsInput,
    AddPropertyToTagPageCommandArgsSchema
} from "./AddPropertyToTagPageCommand";
export {
    AddTagToBlockCommand,
    type AddTagToBlockCommandArgs,
    type AddTagToBlockCommandArgsInput,
    AddTagToBlockCommandArgsSchema
} from "./AddTagToBlockCommand";
export {BaseReversibleCommand} from "./BaseReversibleCommand";
export {
    CreatePageCommand,
    type CreatePageCommandArgs,
    type CreatePageCommandArgsInput,
    CreatePageCommandArgsSchema
} from "./CreatePageCommand";
export {
    CreateTagPageCommand,
    type CreateTagPageCommandArgs,
    type CreateTagPageCommandArgsInput,
    CreateTagPageCommandArgsSchema
} from "./CreateTagPageCommand";
export {
    DataScriptQueryCommand,
    type DataScriptQueryCommandArgs,
    type DataScriptQueryCommandArgsInput,
    DataScriptQueryCommandArgsSchema
} from "./DataScriptQueryCommand";
export {
    DeleteBlockCommand,
    type DeleteBlockCommandArgs,
    type DeleteBlockCommandArgsInput,
    DeleteBlockCommandArgsSchema
} from "./DeleteBlockCommand";
export {
    DeletePageCommand,
    type DeletePageCommandArgs,
    type DeletePageCommandArgsInput,
    DeletePageCommandArgsSchema
} from "./DeletePageCommand";
export {
    DeletePropertyFromBlockCommand,
    type DeletePropertyFromBlockCommandArgs,
    type DeletePropertyFromBlockCommandArgsInput,
    DeletePropertyFromBlockCommandArgsSchema
} from "./DeletePropertyFromBlockCommand";
export {
    InsertBlockCommand,
    type InsertBlockCommandArgs,
    type InsertBlockCommandArgsInput,
    InsertBlockCommandArgsSchema
} from "./InsertBlockCommand";
export {
    MoveBlockCommand,
    type MoveBlockCommandArgs,
    type MoveBlockCommandArgsInput,
    MoveBlockCommandArgsSchema
} from "./MoveBlockCommand";
export {
    ReadBlockCommand,
    type ReadBlockCommandArgs,
    type ReadBlockCommandArgsInput,
    ReadBlockCommandArgsSchema,
    type ReadBlockCommandResult
} from "./ReadBlockCommand";
export {
    RemovePropertyFromTagPageCommand,
    type RemovePropertyFromTagPageCommandArgs,
    type RemovePropertyFromTagPageCommandArgsInput,
    RemovePropertyFromTagPageCommandArgsSchema
} from "./RemovePropertyFromTagPageCommand";
export {
    RemoveTagFromBlockCommand,
    type RemoveTagFromBlockCommandArgs,
    type RemoveTagFromBlockCommandArgsInput,
    RemoveTagFromBlockCommandArgsSchema
} from "./RemoveTagFromBlockCommand";
export {
    RenamePageCommand,
    type RenamePageCommandArgs,
    type RenamePageCommandArgsInput,
    RenamePageCommandArgsSchema
} from "./RenamePageCommand";
export {
    RestorePageCommand,
    type RestorePageCommandArgs,
    type RestorePageCommandArgsInput,
    RestorePageCommandArgsSchema
} from "./RestorePageCommand";
export {
    TextSearchCommand,
    type TextSearchCommandArgs,
    type TextSearchCommandArgsInput,
    TextSearchCommandArgsSchema
} from "./TextSearchCommand";
export {
    UpdateBlockCommand,
    type UpdateBlockCommandArgs,
    type UpdateBlockCommandArgsInput,
    UpdateBlockCommandArgsSchema
} from "./UpdateBlockCommand";
export {
    UpsertPropertyPageCommand,
    type UpsertPropertyPageCommandArgs,
    type UpsertPropertyPageCommandArgsInput,
    UpsertPropertyPageCommandArgsSchema
} from "./UpsertPropertyPageCommand";
export {
    UpsertPropertyToBlockCommand,
    type UpsertPropertyToBlockCommandArgs,
    type UpsertPropertyToBlockCommandArgsInput,
    UpsertPropertyToBlockCommandArgsSchema
} from "./UpsertPropertyToBlockCommand";
export const LogseqReversibleCommandCodec = z.discriminatedUnion("type", [
    AddPropertyToTagPageCommandCodec,
    AddTagToBlockCommandCodec,
    CreatePageCommandCodec,
    CreateTagPageCommandCodec,
    DataScriptQueryCommandCodec,
    DeleteBlockCommandCodec,
    DeletePageCommandCodec,
    DeletePropertyFromBlockCommandCodec,
    InsertBlockCommandCodec,
    MoveBlockCommandCodec,
    ReadBlockCommandCodec,
    RemovePropertyFromTagPageCommandCodec,
    RemoveTagFromBlockCommandCodec,
    RenamePageCommandCodec,
    RestorePageCommandCodec,
    TextSearchCommandCodec,
    UpdateBlockCommandCodec,
    UpsertPropertyPageCommandCodec,
    UpsertPropertyToBlockCommandCodec
]);

export type SerializedLogseqReversibleCommand = z.input<typeof LogseqReversibleCommandCodec>;
export type LogseqReversibleCommand = z.output<typeof LogseqReversibleCommandCodec>;
