import type {BlockIdentity, EntityID, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {LogseqIdentitySchema} from "./schemas";

export const MoveBlockCommandArgsSchema = z.object({
    srcBlockUuid: LogseqIdentitySchema.describe("Block identity to move."),
    destBlockUuid: LogseqIdentitySchema.describe("Destination block identity."),
    before: z.boolean().optional().describe("Move the source immediately before the destination."),
    children: z.boolean().optional().describe("Keep source descendants attached.")
});

export type MoveBlockCommandArgs = z.infer<typeof MoveBlockCommandArgsSchema>;

const MoveBlockCommandDataSchema = MoveBlockCommandArgsSchema.extend({
    type: z.literal("MoveBlock")
});

export class MoveBlockCommand extends BaseReversibleCommand {
    private originalParent: BlockIdentity | EntityID | undefined;

    public constructor(public readonly args: MoveBlockCommandArgs) {
        super();
    }

    public async execute(_deterministicUUIDGenerator: DeterministicUUIDGenerator) {
        const originalBlock = await logseq.Editor.getBlock(
            this.args.srcBlockUuid as BlockIdentity | EntityID
        );
        if (!originalBlock)
            throw new Error(`Block not found: ${JSON.stringify(this.args.srcBlockUuid)}`);

        this.originalParent = originalBlock.parent.id;
        await logseq.Editor.moveBlock(
            this.args.srcBlockUuid as BlockIdentity,
            this.args.destBlockUuid as BlockIdentity,
            {before: this.args.before, children: this.args.children}
        );
        this.changedPages.push(originalBlock.page as unknown as PageIdentity);

        const movedBlock = await logseq.Editor.getBlock(
            this.args.srcBlockUuid as BlockIdentity | EntityID
        );
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
