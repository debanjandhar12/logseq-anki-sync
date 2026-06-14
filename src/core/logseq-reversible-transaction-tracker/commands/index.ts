import {z} from "zod";
import {CreatePageCommandCodec} from "./CreatePageCommand";
import {DeletePageCommandCodec} from "./DeletePageCommand";
import {InsertBlockCommandCodec} from "./InsertBlockCommand";
import {MoveBlockCommandCodec} from "./MoveBlockCommand";
import {RenamePageCommandCodec} from "./RenamePageCommand";
import {UpdateBlockCommandCodec} from "./UpdateBlockCommand";

export {BaseReversibleCommand} from "./BaseReversibleCommand";
export {
    CreatePageCommand,
    type CreatePageCommandArgs,
    CreatePageCommandArgsSchema
} from "./CreatePageCommand";
export {
    DeletePageCommand,
    type DeletePageCommandArgs,
    DeletePageCommandArgsSchema
} from "./DeletePageCommand";
export {
    InsertBlockCommand,
    type InsertBlockCommandArgs,
    InsertBlockCommandArgsSchema
} from "./InsertBlockCommand";
export {
    MoveBlockCommand,
    type MoveBlockCommandArgs,
    MoveBlockCommandArgsSchema
} from "./MoveBlockCommand";
export {
    RenamePageCommand,
    type RenamePageCommandArgs,
    RenamePageCommandArgsSchema
} from "./RenamePageCommand";
export {
    UpdateBlockCommand,
    type UpdateBlockCommandArgs,
    UpdateBlockCommandArgsSchema
} from "./UpdateBlockCommand";

export const LogseqReversibleCommandCodec = z.discriminatedUnion("type", [
    CreatePageCommandCodec,
    DeletePageCommandCodec,
    InsertBlockCommandCodec,
    MoveBlockCommandCodec,
    RenamePageCommandCodec,
    UpdateBlockCommandCodec
]);

export type SerializedLogseqReversibleCommand = z.input<typeof LogseqReversibleCommandCodec>;
export type LogseqReversibleCommand = z.output<typeof LogseqReversibleCommandCodec>;
