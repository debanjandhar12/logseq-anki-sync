import type {BlockIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {resolvePageUUID} from "./utils/normalizeBlock";
import {requireActiveBlock} from "./utils/validations";

export const UpdateBlockCommandArgsSchema = z.object({
    blockUuid: LogseqUUIDSchema.describe("UUID of the Logseq block to update."),
    content: z.string().describe("New block content.")
});

export type UpdateBlockCommandArgsInput = z.input<typeof UpdateBlockCommandArgsSchema>;
export type UpdateBlockCommandArgs = z.output<typeof UpdateBlockCommandArgsSchema>;

const UpdateBlockCommandSerializedSchema = UpdateBlockCommandArgsSchema.extend({
    type: z.literal("UpdateBlock")
});

export type UpdateBlockCommandSerializedState = Omit<
    z.output<typeof UpdateBlockCommandSerializedSchema>,
    "type" | keyof UpdateBlockCommandArgs
>;

/**
 * Updates a Logseq block's content.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - originalContent
 */
export class UpdateBlockCommand extends BaseReversibleCommand {
    private originalContent: string | undefined;
    public readonly args: UpdateBlockCommandArgs;

    public constructor(args: UpdateBlockCommandArgsInput) {
        super();
        this.args = UpdateBlockCommandArgsSchema.parse(args);
    }

    public async execute() {
        const originalBlock = await requireActiveBlock(this.args.blockUuid as BlockIdentity);
        this.originalContent = originalBlock.content ?? "";
        if (originalBlock.page) this.changedPages.push(await resolvePageUUID(originalBlock.page));
        await LogseqEditor.updateBlock(this.args.blockUuid as BlockIdentity, this.args.content);
        return true;
    }

    public async revert(): Promise<void> {
        if (this.originalContent === undefined)
            throw new Error("Execute must be called before revert");

        await LogseqEditor.updateBlock(this.args.blockUuid as BlockIdentity, this.originalContent);
    }
}

export const UpdateBlockCommandCodec = createReversibleCommandCodec({
    type: "UpdateBlock",
    serializedSchema: UpdateBlockCommandSerializedSchema,
    commandSchema: z.instanceof(UpdateBlockCommand),
    decode: (args) => new UpdateBlockCommand(args),
    encodeData: (command) => command.args
});
