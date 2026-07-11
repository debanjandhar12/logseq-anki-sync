import type {BlockIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
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

export type MoveBlockCommandArgsInput = z.input<typeof MoveBlockCommandArgsSchema>;
export type MoveBlockCommandArgs = z.output<typeof MoveBlockCommandArgsSchema>;

const MoveBlockCommandSerializedSchema = MoveBlockCommandArgsSchema.extend({
    type: z.literal("MoveBlock")
});

export type MoveBlockCommandSerializedState = Omit<
    z.output<typeof MoveBlockCommandSerializedSchema>,
    "type" | keyof MoveBlockCommandArgs
>;

/**
 * Moves a block to a destination block or page.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - originalPreviousBlockUuid
 * - originalIsPreviousBlockParent
 */
export class MoveBlockCommand extends BaseReversibleCommand {
    private originalPreviousBlockUuid: string | undefined;
    private originalIsPreviousBlockParent: boolean | undefined;
    public readonly args: MoveBlockCommandArgs;

    public constructor(args: MoveBlockCommandArgsInput) {
        super();
        this.args = MoveBlockCommandArgsSchema.parse(args);
    }

    public async execute() {
        const originalBlock = await requireActiveBlock(
            this.args.srcBlockUuid as BlockIdentity,
            "Source"
        );
        if (await LogseqEditor.isPageBlock(originalBlock)) {
            throw new Error("Cannot move a page. Src block UUID must be a block UUID.");
        }

        const destBlock = await requireActiveBlock(
            this.args.destBlockUuid as BlockIdentity,
            "Destination"
        );

        if (originalBlock.id === destBlock.id) {
            throw new Error("Cannot move a block to itself.");
        }

        let currentParentIdentity = destBlock.parent?.id ?? destBlock.parent?.uuid;
        while (currentParentIdentity != null) {
            if (
                currentParentIdentity === originalBlock.id ||
                currentParentIdentity === originalBlock.uuid
            ) {
                throw new Error("Cannot move a parent block into its own descendant.");
            }
            const parentBlock = await logseq.Editor.getBlock(currentParentIdentity);
            currentParentIdentity = parentBlock?.parent?.id ?? parentBlock?.parent?.uuid;
        }

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

export const MoveBlockCommandCodec = createReversibleCommandCodec({
    type: "MoveBlock",
    serializedSchema: MoveBlockCommandSerializedSchema,
    commandSchema: z.instanceof(MoveBlockCommand),
    decode: (args) => new MoveBlockCommand(args),
    encodeData: (command) => command.args
});
