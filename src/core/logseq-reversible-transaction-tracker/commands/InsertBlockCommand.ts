import type {BlockIdentity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
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
    type: z.literal("InsertBlock")
});

export class InsertBlockCommand extends BaseReversibleCommand {
    private insertedBlockUUID: string | undefined;
    public readonly args: InsertBlockCommandArgs;

    public constructor(args: z.input<typeof InsertBlockCommandArgsSchema>) {
        super();
        this.args = InsertBlockCommandArgsSchema.parse(args);
    }

    public async execute(deterministicUUIDGenerator: DeterministicUUIDGenerator) {
        await requireActiveBlock(this.args.parentUuid as BlockIdentity, "Parent");

        const rawBlock = await logseq.Editor.insertBlock(
            this.args.parentUuid as BlockIdentity,
            this.args.content,
            {
                before: this.args.before,
                sibling: this.args.sibling,
                start: this.args.start,
                end: this.args.end,
                customUUID: deterministicUUIDGenerator.getUUID()
            }
        );
        if (!rawBlock)
            throw new Error(
                `Logseq failed to insert block under: ${JSON.stringify(this.args.parentUuid)}`
            );

        const block = await normalizeBlock(rawBlock);
        this.insertedBlockUUID = block.uuid;
        this.changedPages.push(await resolvePageUUID(block.page));
        return block;
    }

    public async revert(): Promise<void> {
        if (!this.insertedBlockUUID) throw new Error("Execute must be called before revert");

        await logseq.Editor.removeBlock(this.insertedBlockUUID);
    }
}

export const InsertBlockCommandCodec = z.codec(
    InsertBlockCommandDataSchema,
    z.instanceof(InsertBlockCommand),
    {
        decode: ({type: _, ...args}) => new InsertBlockCommand(args),
        encode: (command) => ({type: "InsertBlock" as const, ...command.args})
    }
);
