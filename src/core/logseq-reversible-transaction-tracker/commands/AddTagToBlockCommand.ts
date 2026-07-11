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

const AddTagToBlockCommandSerializedSchema = AddTagToBlockCommandArgsBaseSchema.extend({
    type: z.literal("AddTagToBlock")
});

export class AddTagToBlockCommand extends BaseReversibleCommand {
    private executed = false;
    public readonly args: AddTagToBlockCommandArgs;

    public constructor(args: AddTagToBlockCommandArgsInput) {
        super();
        this.args = AddTagToBlockCommandArgsSchema.parse(args);
    }

    public async execute() {
        const originalBlock = await requireBlockWithoutTag(
            this.args.blockUuid,
            this.args.tagPageUuid
        );
        this.changedPages.push(await resolvePageUUID(originalBlock.page ?? originalBlock));

        await logseq.Editor.addBlockTag(this.args.blockUuid, this.args.tagPageUuid);
        this.executed = true;
        const updatedBlock = await logseq.Editor.getBlock(this.args.blockUuid as BlockIdentity);
        if (!updatedBlock) throw new Error(`Updated block not found: ${this.args.blockUuid}`);
        return await normalizeBlock(updatedBlock);
    }

    public async revert(): Promise<void> {
        if (!this.executed) throw new Error("Execute must be called before revert");
        await logseq.Editor.removeBlockTag(this.args.blockUuid, this.args.tagPageUuid);
        this.executed = false;
    }
}

export const AddTagToBlockCommandCodec = createReversibleCommandCodec({
    type: "AddTagToBlock",
    serializedSchema: AddTagToBlockCommandSerializedSchema,
    commandSchema: z.instanceof(AddTagToBlockCommand),
    decode: (args) => new AddTagToBlockCommand(args),
    encodeData: (command) => command.args
});
