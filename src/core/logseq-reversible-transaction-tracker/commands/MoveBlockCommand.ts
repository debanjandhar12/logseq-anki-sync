import type {BlockIdentity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {z} from "zod";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {normalizeBlock, resolvePageUUID} from "./utils/normalizeBlock";
import {requireActiveBlock} from "./utils/validations";

export const MoveBlockCommandArgsSchema = z
    .object({
        srcBlockUuid: LogseqUUIDSchema.describe("UUID of the Logseq block to move."),
        destBlockUuid: LogseqUUIDSchema.describe("UUID of the destination Logseq block."),
        before: z
            .boolean()
            .optional()
            .describe(
                "Move src as a sibling BEFORE dest. Only meaningful with children=false. Omit when children=true."
            ),
        children: z
            .boolean()
            .default(false)
            .describe("Make src a child of dest. When true, `before` must be omitted.")
    })
    .refine((args) => !(args.children === true && args.before !== undefined), {
        message: "`before` is meaningless when `children` is true. Omit `before`.",
        path: ["before"]
    });

export type MoveBlockCommandArgs = z.infer<typeof MoveBlockCommandArgsSchema>;

const MoveBlockCommandDataSchema = MoveBlockCommandArgsSchema.extend({
    type: z.literal("MoveBlock")
});

export class MoveBlockCommand extends BaseReversibleCommand {
    private originalPreviousBlockUuid: string | undefined;
    private originalIsPreviousBlockParent: boolean | undefined;
    public readonly args: MoveBlockCommandArgs;

    public constructor(args: z.input<typeof MoveBlockCommandArgsSchema>) {
        super();
        this.args = MoveBlockCommandArgsSchema.parse(args);
    }

    public async execute(_deterministicUUIDGenerator: DeterministicUUIDGenerator) {
        const originalBlock = await requireActiveBlock(
            this.args.srcBlockUuid as BlockIdentity,
            "Source"
        );
        await requireActiveBlock(this.args.destBlockUuid as BlockIdentity, "Destination");

        const previousBlock = await LogseqEditor.getPreviousBlock(
            this.args.srcBlockUuid as BlockIdentity,
            {parent: true}
        );
        const isPreviousBlockParent = await LogseqEditor.getWhetherPreviousBlockIsParent(
            this.args.srcBlockUuid as BlockIdentity
        );
        if (!previousBlock) throw new Error("Source block has no previous block or parent");

        this.originalPreviousBlockUuid = previousBlock.uuid;
        this.originalIsPreviousBlockParent = isPreviousBlockParent;

        await logseq.Editor.moveBlock(
            this.args.srcBlockUuid as BlockIdentity,
            this.args.destBlockUuid as BlockIdentity,
            {before: this.args.before, children: this.args.children}
        );
        this.changedPages.push(await resolvePageUUID(originalBlock.page));

        const rawMovedBlock = await logseq.Editor.getBlock(this.args.srcBlockUuid as BlockIdentity);
        const movedBlock = rawMovedBlock ? await normalizeBlock(rawMovedBlock) : null;
        if (movedBlock?.page) this.changedPages.push(await resolvePageUUID(movedBlock.page));

        return true;
    }

    public async revert(): Promise<void> {
        if (!this.originalPreviousBlockUuid || this.originalIsPreviousBlockParent === undefined) {
            throw new Error("Execute must be called before revert");
        }

        if (!this.originalIsPreviousBlockParent) {
            await logseq.Editor.moveBlock(
                this.args.srcBlockUuid as BlockIdentity,
                this.originalPreviousBlockUuid as BlockIdentity,
                {}
            );
        } else {
            const nextBlock = await LogseqEditor.getNextBlock(
                this.originalPreviousBlockUuid as BlockIdentity,
                {children: true}
            );

            if (!nextBlock) {
                await logseq.Editor.moveBlock(
                    this.args.srcBlockUuid as BlockIdentity,
                    this.originalPreviousBlockUuid as BlockIdentity,
                    {children: true}
                );
                return;
            }

            await logseq.Editor.moveBlock(
                this.args.srcBlockUuid as BlockIdentity,
                nextBlock.uuid as BlockIdentity,
                {before: true}
            );
        }
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
