import type {BlockIdentity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {normalizeBlock} from "./utils/normalizeBlock";

export const MoveBlockCommandArgsSchema = z.object({
    srcBlockUuid: LogseqUUIDSchema.describe("UUID of the Logseq block to move."),
    destBlockUuid: LogseqUUIDSchema.describe("UUID of the destination Logseq block."),
    before: z.boolean().optional().describe("Move the source immediately before the destination."),
    children: z.boolean().optional().describe("Keep source descendants attached.")
});

export type MoveBlockCommandArgs = z.infer<typeof MoveBlockCommandArgsSchema>;

const MoveBlockCommandDataSchema = MoveBlockCommandArgsSchema.extend({
    type: z.literal("MoveBlock")
});

export class MoveBlockCommand extends BaseReversibleCommand {
    private originalParent: BlockIdentity | undefined;
    public readonly args: MoveBlockCommandArgs;

    public constructor(args: MoveBlockCommandArgs) {
        super();
        this.args = MoveBlockCommandArgsSchema.parse(args);
    }

    public async execute(_deterministicUUIDGenerator: DeterministicUUIDGenerator) {
        const rawOriginalBlock = await logseq.Editor.getBlock(
            this.args.srcBlockUuid as BlockIdentity
        );
        if (!rawOriginalBlock)
            throw new Error(`Block not found: ${JSON.stringify(this.args.srcBlockUuid)}`);

        const originalBlock = await normalizeBlock(rawOriginalBlock);
        this.originalParent = originalBlock.parent.uuid;
        await logseq.Editor.moveBlock(
            this.args.srcBlockUuid as BlockIdentity,
            this.args.destBlockUuid as BlockIdentity,
            {before: this.args.before, children: this.args.children}
        );
        this.changedPages.push(originalBlock.page as unknown as PageIdentity);

        const rawMovedBlock = await logseq.Editor.getBlock(this.args.srcBlockUuid as BlockIdentity);
        const movedBlock = rawMovedBlock ? await normalizeBlock(rawMovedBlock) : null;
        if (movedBlock?.page) this.changedPages.push(movedBlock.page as unknown as PageIdentity);

        return true;
    }

    public async revert(): Promise<void> {
        if (!this.originalParent) throw new Error("Execute must be called before revert");

        await logseq.Editor.moveBlock(
            this.args.srcBlockUuid as BlockIdentity,
            this.originalParent as BlockIdentity,
            {children: true}
        );
    }
}

export const MoveBlockCommandCodec = z.codec(
    MoveBlockCommandDataSchema,
    z.instanceof(MoveBlockCommand),
    {
        decode: ({type: _, ...args}) => new MoveBlockCommand(args),
        encode: (command) => ({type: "MoveBlock" as const, ...command.args})
    }
);
