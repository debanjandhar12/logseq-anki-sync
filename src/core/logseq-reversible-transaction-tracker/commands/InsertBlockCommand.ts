import type {BlockIdentity, EntityID, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {InsertBlockOptionsSchema, LogseqIdentitySchema} from "./schemas";
import {normalizeBlock} from "./utils/normalizeBlock";

export const InsertBlockCommandArgsSchema = z.object({
    parentUuid: LogseqIdentitySchema.describe("Parent page or block identity."),
    content: z.string().describe("Content of the block to insert."),
    options: InsertBlockOptionsSchema
});

export type InsertBlockCommandArgs = z.infer<typeof InsertBlockCommandArgsSchema>;

const InsertBlockCommandDataSchema = InsertBlockCommandArgsSchema.extend({
    type: z.literal("InsertBlock")
});

export class InsertBlockCommand extends BaseReversibleCommand {
    private insertedBlockUUID: string | undefined;

    public constructor(public readonly args: InsertBlockCommandArgs) {
        super();
    }

    public async execute(deterministicUUIDGenerator: DeterministicUUIDGenerator) {
        const rawBlock = await logseq.Editor.insertBlock(
            this.args.parentUuid as BlockIdentity | EntityID,
            this.args.content,
            {...this.args.options, customUUID: deterministicUUIDGenerator.getUUID()}
        );
        if (!rawBlock)
            throw new Error(
                `Logseq failed to insert block under: ${JSON.stringify(this.args.parentUuid)}`
            );

        const block = await normalizeBlock(rawBlock);
        this.insertedBlockUUID = block.uuid;
        this.changedPages.push(block.page as unknown as PageIdentity);
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
