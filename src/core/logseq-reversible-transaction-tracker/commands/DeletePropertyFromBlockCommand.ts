import type {BlockIdentity} from "@logseq/libs/dist/LSPlugin";
import {
    LogseqBlockPropertyHelper,
    LogseqBlockPropertyNotFoundError
} from "src/logseq/LogseqBlockPropertyHelper";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {normalizeBlock, resolvePageUUID} from "./utils/normalizeBlock";
import {PropertyUuidOrIndentSchema} from "./utils/validations/propertyValidations";

const DeletePropertyFromBlockCommandArgsBaseSchema = z.object({
    blockUuid: LogseqUUIDSchema.describe("UUID of the Logseq block to update."),
    propertyUuidOrIndent: PropertyUuidOrIndentSchema
});

export const DeletePropertyFromBlockCommandArgsSchema =
    DeletePropertyFromBlockCommandArgsBaseSchema;

export type DeletePropertyFromBlockCommandArgsInput = z.input<
    typeof DeletePropertyFromBlockCommandArgsSchema
>;
export type DeletePropertyFromBlockCommandArgs = z.output<
    typeof DeletePropertyFromBlockCommandArgsSchema
>;

const DeletePropertyFromBlockCommandSerializedSchema =
    DeletePropertyFromBlockCommandArgsBaseSchema.extend({
        type: z.literal("DeletePropertyFromBlock")
    });

/**
 * Removes a property value from a Logseq block.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - propertyKey
 * - previousValue
 */
export class DeletePropertyFromBlockCommand extends BaseReversibleCommand {
    private propertyKey: string | undefined;
    private previousValue: unknown;
    private hadPreviousValue = false;
    private previousValueSnapshotTaken = false;
    public readonly args: DeletePropertyFromBlockCommandArgs;

    public constructor(args: DeletePropertyFromBlockCommandArgsInput) {
        super();
        this.args = DeletePropertyFromBlockCommandArgsSchema.parse(args);
    }

    public async execute() {
        const property = await LogseqEditor.getProperty(this.args.propertyUuidOrIndent);
        if (!property) throw new Error("Property page not found");

        const originalBlock = await logseq.Editor.getBlock(this.args.blockUuid as BlockIdentity);
        if (!originalBlock) throw new Error(`Block not found: ${this.args.blockUuid}`);
        this.propertyKey = property.ident;
        try {
            this.previousValue = await LogseqBlockPropertyHelper.getBlockPropertyInputValue(
                this.args.blockUuid,
                this.propertyKey
            );
            this.hadPreviousValue = true;
        } catch (error) {
            if (!(error instanceof LogseqBlockPropertyNotFoundError)) throw error;
            this.previousValue = undefined;
            this.hadPreviousValue = false;
        }
        this.previousValueSnapshotTaken = true;

        this.changedPages.push(await resolvePageUUID(originalBlock.page ?? originalBlock));

        await logseq.Editor.removeBlockProperty(this.args.blockUuid, this.propertyKey);

        const updatedBlock = await logseq.Editor.getBlock(this.args.blockUuid as BlockIdentity);
        if (!updatedBlock) throw new Error(`Updated block not found: ${this.args.blockUuid}`);
        return await normalizeBlock(updatedBlock);
    }

    public async revert(): Promise<void> {
        if (!this.propertyKey || !this.previousValueSnapshotTaken) {
            throw new Error("Execute must be called before revert");
        }

        if (!this.hadPreviousValue) return;

        await logseq.Editor.upsertBlockProperty(
            this.args.blockUuid,
            this.propertyKey,
            this.previousValue,
            {reset: true}
        );
    }
}

export const DeletePropertyFromBlockCommandCodec = createReversibleCommandCodec({
    type: "DeletePropertyFromBlock",
    serializedSchema: DeletePropertyFromBlockCommandSerializedSchema,
    commandSchema: z.instanceof(DeletePropertyFromBlockCommand),
    decode: (args) => new DeletePropertyFromBlockCommand(args),
    encodeData: (command) => command.args
});
