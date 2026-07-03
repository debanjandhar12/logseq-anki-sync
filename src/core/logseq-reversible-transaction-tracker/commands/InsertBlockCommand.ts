import type {BlockIdentity} from "@logseq/libs/dist/LSPlugin";
import {v4 as uuidv4} from "uuid";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
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

export type InsertBlockCommandArgs = z.infer<typeof InsertBlockCommandArgsSchema>;

const InsertBlockCommandDataSchema = InsertBlockCommandArgsSchema.extend({
    type: z.literal("InsertBlock"),
    blockUuid: LogseqUUIDSchema
});

type InsertBlockCommandState = Pick<z.infer<typeof InsertBlockCommandDataSchema>, "blockUuid">;

export class InsertBlockCommand extends BaseReversibleCommand {
    private readonly blockUuid: string;
    public readonly args: InsertBlockCommandArgs;

    public constructor(
        args: z.input<typeof InsertBlockCommandArgsSchema>,
        state?: Partial<InsertBlockCommandState>
    ) {
        super();
        this.args = InsertBlockCommandArgsSchema.parse(args);
        this.blockUuid = LogseqUUIDSchema.parse(state?.blockUuid ?? uuidv4());
    }

    public async execute() {
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
        return block;
    }

    public async revert(): Promise<void> {
        const block = await logseq.Editor.getBlock(this.blockUuid as BlockIdentity);
        if (!block) throw new Error(`Inserted block is missing: ${this.blockUuid}`);

        await logseq.Editor.removeBlock(this.blockUuid);
    }

    public getState(): InsertBlockCommandState {
        return {
            blockUuid: this.blockUuid
        };
    }
}

export const InsertBlockCommandCodec = z.codec(
    InsertBlockCommandDataSchema,
    z.instanceof(InsertBlockCommand),
    {
        decode: ({type: _, blockUuid, ...args}) => new InsertBlockCommand(args, {blockUuid}),
        encode: (command) => ({
            type: "InsertBlock" as const,
            ...command.args,
            ...command.getState()
        })
    }
);
