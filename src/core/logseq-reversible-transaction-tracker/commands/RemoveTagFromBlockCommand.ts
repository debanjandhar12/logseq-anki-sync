import type {BlockIdentity} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {normalizeBlock, resolvePageUUID} from "./utils/normalizeBlock";
import {requireBlockWithTag} from "./utils/validations/tagValidations";

const RemoveTagFromBlockCommandArgsBaseSchema = z.object({
    blockUuid: LogseqUUIDSchema.describe("UUID of the Logseq block to update."),
    tagPageUuid: LogseqUUIDSchema.describe("UUID of the Logseq tag page to remove.")
});

export const RemoveTagFromBlockCommandArgsSchema = RemoveTagFromBlockCommandArgsBaseSchema;
export type RemoveTagFromBlockCommandArgsInput = z.input<
    typeof RemoveTagFromBlockCommandArgsSchema
>;
export type RemoveTagFromBlockCommandArgs = z.output<typeof RemoveTagFromBlockCommandArgsSchema>;

const RemoveTagFromBlockCommandSerializedSchema = RemoveTagFromBlockCommandArgsBaseSchema.extend({
    type: z.literal("RemoveTagFromBlock")
});

export class RemoveTagFromBlockCommand extends BaseReversibleCommand {
    private executed = false;
    public readonly args: RemoveTagFromBlockCommandArgs;

    public constructor(args: RemoveTagFromBlockCommandArgsInput) {
        super();
        this.args = RemoveTagFromBlockCommandArgsSchema.parse(args);
    }

    public async execute() {
        const originalBlock = await requireBlockWithTag(this.args.blockUuid, this.args.tagPageUuid);
        this.changedPages.push(await resolvePageUUID(originalBlock.page ?? originalBlock));

        await logseq.Editor.removeBlockTag(this.args.blockUuid, this.args.tagPageUuid);
        this.executed = true;
        const updatedBlock = await logseq.Editor.getBlock(this.args.blockUuid as BlockIdentity);
        if (!updatedBlock) throw new Error(`Updated block not found: ${this.args.blockUuid}`);
        return await normalizeBlock(updatedBlock);
    }

    public async revert(): Promise<void> {
        if (!this.executed) throw new Error("Execute must be called before revert");
        await logseq.Editor.addBlockTag(this.args.blockUuid, this.args.tagPageUuid);
        this.executed = false;
    }
}

export const RemoveTagFromBlockCommandCodec = createReversibleCommandCodec({
    type: "RemoveTagFromBlock",
    serializedSchema: RemoveTagFromBlockCommandSerializedSchema,
    commandSchema: z.instanceof(RemoveTagFromBlockCommand),
    decode: (args) => new RemoveTagFromBlockCommand(args),
    encodeData: (command) => command.args
});
