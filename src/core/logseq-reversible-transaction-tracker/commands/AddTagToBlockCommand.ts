import type {BlockIdentity} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {normalizeBlock, resolvePageUUID} from "./utils/normalizeBlock";
import {requireBlockWithoutTag} from "./utils/validations/tagValidations";

const AddTagToBlockCommandArgsBaseSchema = z.object({
    blockUuid: LogseqUUIDSchema.describe("UUID of the Logseq block to tag."),
    tagPageUuid: LogseqUUIDSchema.describe("UUID of the Logseq tag page to add.")
});

export const AddTagToBlockCommandArgsSchema = AddTagToBlockCommandArgsBaseSchema;
export type AddTagToBlockCommandArgsInput = z.input<typeof AddTagToBlockCommandArgsSchema>;
export type AddTagToBlockCommandArgs = z.output<typeof AddTagToBlockCommandArgsSchema>;

export const AddTagToBlockCommandStateSchema = z.object({
    status: z.enum(["new", "executed"])
});
export type AddTagToBlockCommandState = z.output<typeof AddTagToBlockCommandStateSchema>;

export class AddTagToBlockCommand extends BaseReversibleCommand<AddTagToBlockCommandState> {
    public readonly args: AddTagToBlockCommandArgs;

    public constructor(
        args: AddTagToBlockCommandArgsInput,
        commandState?: AddTagToBlockCommandState
    ) {
        super(AddTagToBlockCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = AddTagToBlockCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        const originalBlock = await requireBlockWithoutTag(
            this.args.blockUuid,
            this.args.tagPageUuid
        );
        this.changedPages.push(await resolvePageUUID(originalBlock.page ?? originalBlock));

        await logseq.Editor.addBlockTag(this.args.blockUuid, this.args.tagPageUuid);
        const updatedBlock = await logseq.Editor.getBlock(this.args.blockUuid as BlockIdentity);
        if (!updatedBlock) throw new Error(`Updated block not found: ${this.args.blockUuid}`);
        const block = await normalizeBlock(updatedBlock);
        this.commandState.status = "executed";
        return block;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        await logseq.Editor.removeBlockTag(this.args.blockUuid, this.args.tagPageUuid);
        this.commandState.status = "new";
    }
}

export const AddTagToBlockCommandCodec = createReversibleCommandCodec({
    type: "AddTagToBlock",
    argsSchema: AddTagToBlockCommandArgsSchema,
    commandStateSchema: AddTagToBlockCommandStateSchema,
    commandClass: AddTagToBlockCommand
});
