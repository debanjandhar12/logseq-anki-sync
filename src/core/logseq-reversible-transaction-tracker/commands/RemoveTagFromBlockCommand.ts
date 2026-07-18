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

export const RemoveTagFromBlockCommandStateSchema = z.object({
    status: z.enum(["new", "executed"])
});
export type RemoveTagFromBlockCommandState = z.output<typeof RemoveTagFromBlockCommandStateSchema>;

export class RemoveTagFromBlockCommand extends BaseReversibleCommand<RemoveTagFromBlockCommandState> {
    public readonly args: RemoveTagFromBlockCommandArgs;

    public constructor(
        args: RemoveTagFromBlockCommandArgsInput,
        commandState?: RemoveTagFromBlockCommandState
    ) {
        super(RemoveTagFromBlockCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = RemoveTagFromBlockCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        const originalBlock = await requireBlockWithTag(this.args.blockUuid, this.args.tagPageUuid);
        this.changedPages.push(await resolvePageUUID(originalBlock.page ?? originalBlock));

        await logseq.Editor.removeBlockTag(this.args.blockUuid, this.args.tagPageUuid);
        const updatedBlock = await logseq.Editor.getBlock(this.args.blockUuid as BlockIdentity);
        if (!updatedBlock) throw new Error(`Updated block not found: ${this.args.blockUuid}`);
        const block = await normalizeBlock(updatedBlock);
        this.commandState.status = "executed";
        return block;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        await logseq.Editor.addBlockTag(this.args.blockUuid, this.args.tagPageUuid);
        this.commandState.status = "new";
    }
}

export const RemoveTagFromBlockCommandCodec = createReversibleCommandCodec({
    type: "RemoveTagFromBlock",
    argsSchema: RemoveTagFromBlockCommandArgsSchema,
    commandStateSchema: RemoveTagFromBlockCommandStateSchema,
    commandClass: RemoveTagFromBlockCommand
});
