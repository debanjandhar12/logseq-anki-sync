import {z} from "zod";
import {CreatePageCommandCodec} from "./CreatePageCommand";
import {DataScriptQueryCommandCodec} from "./DataScriptQueryCommand";
import {DeleteBlockCommandCodec} from "./DeleteBlockCommand";
import {DeletePageCommandCodec} from "./DeletePageCommand";
import {InsertBlockCommandCodec} from "./InsertBlockCommand";
import {MoveBlockCommandCodec} from "./MoveBlockCommand";
import {ReadBlockCommandCodec} from "./ReadBlockCommand";
import {RenamePageCommandCodec} from "./RenamePageCommand";
import {RestorePageCommandCodec} from "./RestorePageCommand";
import {TextSearchCommandCodec} from "./TextSearchCommand";
import {UpdateBlockCommandCodec} from "./UpdateBlockCommand";

export {BaseReversibleCommand} from "./BaseReversibleCommand";
export {
    CreatePageCommand,
    type CreatePageCommandArgs,
    type CreatePageCommandArgsInput,
    CreatePageCommandArgsSchema
} from "./CreatePageCommand";
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
export const LogseqReversibleCommandCodec = z.discriminatedUnion("type", [
    CreatePageCommandCodec,
    DataScriptQueryCommandCodec,
    DeleteBlockCommandCodec,
    DeletePageCommandCodec,
    InsertBlockCommandCodec,
    MoveBlockCommandCodec,
    ReadBlockCommandCodec,
    RenamePageCommandCodec,
    RestorePageCommandCodec,
    TextSearchCommandCodec,
    UpdateBlockCommandCodec
]);

export type SerializedLogseqReversibleCommand = z.input<typeof LogseqReversibleCommandCodec>;
export type LogseqReversibleCommand = z.output<typeof LogseqReversibleCommandCodec>;
