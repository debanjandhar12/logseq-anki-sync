import {z} from "zod";
import {CreatePageCommandCodec} from "./CreatePageCommand";
import {DeleteBlockCommandCodec} from "./DeleteBlockCommand";
import {DeletePageCommandCodec} from "./DeletePageCommand";
import {InsertBlockCommandCodec} from "./InsertBlockCommand";
import {MoveBlockCommandCodec} from "./MoveBlockCommand";
import {RenamePageCommandCodec} from "./RenamePageCommand";
import {UpdateBlockCommandCodec} from "./UpdateBlockCommand";

export {BaseReversibleCommand} from "./BaseReversibleCommand";
export {
    CreatePageCommand,
    type CreatePageCommandArgs,
    type CreatePageCommandArgsInput,
    CreatePageCommandArgsSchema
} from "./CreatePageCommand";
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
    RenamePageCommand,
    type RenamePageCommandArgs,
    type RenamePageCommandArgsInput,
    RenamePageCommandArgsSchema
} from "./RenamePageCommand";
export {
    UpdateBlockCommand,
    type UpdateBlockCommandArgs,
    type UpdateBlockCommandArgsInput,
    UpdateBlockCommandArgsSchema
} from "./UpdateBlockCommand";
export const LogseqReversibleCommandCodec = z.discriminatedUnion("type", [
    CreatePageCommandCodec,
    DeleteBlockCommandCodec,
    DeletePageCommandCodec,
    InsertBlockCommandCodec,
    MoveBlockCommandCodec,
    RenamePageCommandCodec,
    UpdateBlockCommandCodec
]);

export type SerializedLogseqReversibleCommand = z.input<typeof LogseqReversibleCommandCodec>;
export type LogseqReversibleCommand = z.output<typeof LogseqReversibleCommandCodec>;
