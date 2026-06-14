import type {BlockIdentity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {z} from "zod";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {normalizeBlock} from "./utils/normalizeBlock";

export const UpdateBlockCommandArgsSchema = z.object({
    blockUuid: LogseqUUIDSchema.describe("UUID of the Logseq block to update."),
    content: z.string().describe("New block content.")
});

export type UpdateBlockCommandArgs = z.infer<typeof UpdateBlockCommandArgsSchema>;

const UpdateBlockCommandDataSchema = UpdateBlockCommandArgsSchema.extend({
    type: z.literal("UpdateBlock")
});

export class UpdateBlockCommand extends BaseReversibleCommand {
    private originalContent: string | undefined;
    public readonly args: UpdateBlockCommandArgs;

    public constructor(args: UpdateBlockCommandArgs) {
        super();
        this.args = UpdateBlockCommandArgsSchema.parse(args);
    }

    public async execute(_deterministicUUIDGenerator: DeterministicUUIDGenerator) {
        const rawOriginalBlock = await logseq.Editor.getBlock(this.args.blockUuid as BlockIdentity);
        if (!rawOriginalBlock)
            throw new Error(`Block not found: ${JSON.stringify(this.args.blockUuid)}`);

        const originalBlock = await normalizeBlock(rawOriginalBlock);
        this.originalContent = originalBlock.content ?? "";
        if (originalBlock.page)
            this.changedPages.push(originalBlock.page as unknown as PageIdentity);
        await LogseqEditor.updateBlock(this.args.blockUuid as BlockIdentity, this.args.content);
        return true;
    }

    public async revert(): Promise<void> {
        if (this.originalContent === undefined)
            throw new Error("Execute must be called before revert");

        await LogseqEditor.updateBlock(this.args.blockUuid as BlockIdentity, this.originalContent);
    }
}

export const UpdateBlockCommandCodec = z.codec(
    UpdateBlockCommandDataSchema,
    z.instanceof(UpdateBlockCommand),
    {
        decode: ({type: _, ...args}) => new UpdateBlockCommand(args),
        encode: (command) => ({type: "UpdateBlock" as const, ...command.args})
    }
);
