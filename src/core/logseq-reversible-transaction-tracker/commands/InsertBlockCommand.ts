import type {BlockIdentity} from "@logseq/libs/dist/LSPlugin";
import {v4 as uuidv4} from "uuid";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {isBlockSoftDeleted} from "./utils/isBlockSoftDeleted";
import {normalizeBlock, resolvePageUUID} from "./utils/normalizeBlock";
import {requireActiveBlock} from "./utils/validations";

export const InsertBlockCommandArgsSchema = z
    .object({
        parentUuid: LogseqUUIDSchema.describe("UUID of the parent Logseq page or block."),
        content: z.string().describe("Content of the block to insert."),
        before: z
            .boolean()
            .optional()
            .describe(
                "Insert before the anchor. Only meaningful with sibling=true. Omit when sibling=false."
            ),
        sibling: z
            .boolean()
            .default(true)
            .describe(
                "Insert as a sibling of the anchor block. When false, insert as a child and use start/end."
            ),
        start: z
            .boolean()
            .optional()
            .describe("Insert as the FIRST child. Only valid when sibling=false."),
        end: z
            .boolean()
            .optional()
            .describe("Insert as the LAST child. Only valid when sibling=false.")
    })
    .refine((args) => !(args.sibling === false && args.before !== undefined), {
        message:
            "`before` is meaningless when `sibling` is false. Omit `before` and use start/end.",
        path: ["before"]
    })
    .refine(
        (args) => !(args.sibling === true && (args.start !== undefined || args.end !== undefined)),
        {
            message: "`start`/`end` are only valid when `sibling` is false.",
            path: ["start"]
        }
    );

export type InsertBlockCommandArgsInput = z.input<typeof InsertBlockCommandArgsSchema>;
export type InsertBlockCommandArgs = z.output<typeof InsertBlockCommandArgsSchema>;

export const InsertBlockCommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    blockUuid: LogseqUUIDSchema
});
export type InsertBlockCommandState = z.output<typeof InsertBlockCommandStateSchema>;

/**
 * Inserts a Logseq block with a stable UUID.
 *
 * Serialized data:
 * - args
 * - blockUuid
 *
 * Runtime-only data:
 * - none
 */
export class InsertBlockCommand extends BaseReversibleCommand<InsertBlockCommandState> {
    public readonly args: InsertBlockCommandArgs;

    public constructor(args: InsertBlockCommandArgsInput, commandState?: InsertBlockCommandState) {
        super(
            InsertBlockCommandStateSchema.parse(
                commandState ?? {status: "new", blockUuid: uuidv4()}
            )
        );
        this.args = InsertBlockCommandArgsSchema.parse(args);
    }

    public get blockUuid(): string {
        return this.commandState.blockUuid;
    }

    public async execute() {
        this.assertCanExecute();
        await requireActiveBlock(this.args.parentUuid as BlockIdentity, "Parent");

        const existingBlock = await logseq.Editor.getBlock(this.blockUuid as BlockIdentity);
        if (existingBlock) {
            const block = await normalizeBlock(existingBlock);
            if (await isBlockSoftDeleted(block)) {
                throw new Error(
                    `Inserted block already exists in a deleted page: ${this.blockUuid}`
                );
            }
            if ((block.content ?? "") !== this.args.content) {
                throw new Error(`Block already exists with different content: ${this.blockUuid}`);
            }

            this.changedPages.push(await resolvePageUUID(block.page));
            this.commandState.status = "executed";
            return block;
        }

        const rawBlock = await logseq.Editor.insertBlock(
            this.args.parentUuid as BlockIdentity,
            this.args.content,
            {
                before: this.args.before,
                sibling: this.args.sibling,
                start: this.args.start,
                end: this.args.end,
                customUUID: this.blockUuid
            }
        );
        if (!rawBlock)
            throw new Error(
                `Logseq failed to insert block under: ${JSON.stringify(this.args.parentUuid)}`
            );

        const block = await normalizeBlock(rawBlock);
        this.changedPages.push(await resolvePageUUID(block.page));
        this.commandState.status = "executed";
        return block;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        const block = await logseq.Editor.getBlock(this.blockUuid as BlockIdentity);
        if (!block) throw new Error(`Inserted block is missing: ${this.blockUuid}`);

        await logseq.Editor.removeBlock(this.blockUuid);
        this.commandState.status = "new";
    }
}

export const InsertBlockCommandCodec = createReversibleCommandCodec({
    type: "InsertBlock",
    argsSchema: InsertBlockCommandArgsSchema,
    commandStateSchema: InsertBlockCommandStateSchema,
    commandClass: InsertBlockCommand
});
