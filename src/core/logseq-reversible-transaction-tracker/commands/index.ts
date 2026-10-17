import {z} from "zod";
import {AddPropertyToTagPageCommandCodec} from "./AddPropertyToTagPageCommand";
import {AddTagToBlockCommandCodec} from "./AddTagToBlockCommand";
import {CreatePageCommandCodec} from "./CreatePageCommand";
import {CreateTagPageCommandCodec} from "./CreateTagPageCommand";
import {DataScriptQueryCommandCodec} from "./DataScriptQueryCommand";
import {DeleteBlockCommandCodec} from "./DeleteBlockCommand";
import {DeleteCommandFileCommandCodec} from "./DeleteCommandFileCommand";
import {DeletePageCommandCodec} from "./DeletePageCommand";
import {DeletePropertyFromBlockCommandCodec} from "./DeletePropertyFromBlockCommand";
import {DeleteSkillFileCommandCodec} from "./DeleteSkillFileCommand";
import {InsertBlockCommandCodec} from "./InsertBlockCommand";
import {MoveBlockCommandCodec} from "./MoveBlockCommand";
import {PutAssetFileCommandCodec} from "./PutAssetFileCommand";
import {PutCommandFileCommandCodec} from "./PutCommandFileCommand";
import {PutSkillFileCommandCodec} from "./PutSkillFileCommand";
import {ReadAssetFileCommandCodec} from "./ReadAssetFileCommand";
import {ReadBlockCommandCodec} from "./ReadBlockCommand";
import {ReadCommandFileCommandCodec} from "./ReadCommandFileCommand";
import {ReadParsedSkillFileCommandCodec} from "./ReadParsedSkillFileCommand";
import {ReadSkillFileCommandCodec} from "./ReadSkillFileCommand";
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
export {BaseReversibleCommand, type ReversibleCommandStatus} from "./BaseReversibleCommand";
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
    DeleteCommandFileCommand,
    type DeleteCommandFileCommandArgs,
    type DeleteCommandFileCommandArgsInput,
    DeleteCommandFileCommandArgsSchema
} from "./DeleteCommandFileCommand";
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
    DeleteSkillFileCommand,
    type DeleteSkillFileCommandArgs,
    type DeleteSkillFileCommandArgsInput,
    DeleteSkillFileCommandArgsSchema
} from "./DeleteSkillFileCommand";
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
    PutAssetFileCommand,
    type PutAssetFileCommandArgs,
    type PutAssetFileCommandArgsInput,
    PutAssetFileCommandArgsSchema
} from "./PutAssetFileCommand";
export {
    PutCommandFileCommand,
    type PutCommandFileCommandArgs,
    type PutCommandFileCommandArgsInput,
    PutCommandFileCommandArgsSchema
} from "./PutCommandFileCommand";
export {
    PutSkillFileCommand,
    type PutSkillFileCommandArgs,
    type PutSkillFileCommandArgsInput,
    PutSkillFileCommandArgsSchema
} from "./PutSkillFileCommand";
export {
    ReadAssetFileCommand,
    type ReadAssetFileCommandArgs,
    type ReadAssetFileCommandArgsInput,
    ReadAssetFileCommandArgsSchema,
    type ReadAssetFileCommandResult
} from "./ReadAssetFileCommand";
export {
    ReadBlockCommand,
    type ReadBlockCommandArgs,
    type ReadBlockCommandArgsInput,
    ReadBlockCommandArgsSchema,
    type ReadBlockCommandResult
} from "./ReadBlockCommand";
export {
    ReadCommandFileCommand,
    type ReadCommandFileCommandArgs,
    type ReadCommandFileCommandArgsInput,
    ReadCommandFileCommandArgsSchema,
    type ReadCommandFileCommandResult
} from "./ReadCommandFileCommand";
export {
    ReadParsedSkillFileCommand,
    type ReadParsedSkillFileCommandArgs,
    type ReadParsedSkillFileCommandArgsInput,
    ReadParsedSkillFileCommandArgsSchema,
    type ReadParsedSkillFileCommandResult
} from "./ReadParsedSkillFileCommand";
export {
    ReadSkillFileCommand,
    type ReadSkillFileCommandArgs,
    type ReadSkillFileCommandArgsInput,
    ReadSkillFileCommandArgsSchema,
    type ReadSkillFileCommandResult
} from "./ReadSkillFileCommand";
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
export {isFlashcardBlock} from "./utils/isFlashcardBlock";
export {isVideoBlock} from "./utils/isVideoBlock";
export const LogseqReversibleCommandCodec = z.discriminatedUnion("type", [
    AddPropertyToTagPageCommandCodec,
    AddTagToBlockCommandCodec,
    CreatePageCommandCodec,
    CreateTagPageCommandCodec,
    DataScriptQueryCommandCodec,
    DeleteBlockCommandCodec,
    DeleteCommandFileCommandCodec,
    DeletePageCommandCodec,
    DeletePropertyFromBlockCommandCodec,
    DeleteSkillFileCommandCodec,
    InsertBlockCommandCodec,
    MoveBlockCommandCodec,
    PutAssetFileCommandCodec,
    PutCommandFileCommandCodec,
    PutSkillFileCommandCodec,
    ReadAssetFileCommandCodec,
    ReadBlockCommandCodec,
    ReadCommandFileCommandCodec,
    ReadParsedSkillFileCommandCodec,
    ReadSkillFileCommandCodec,
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
