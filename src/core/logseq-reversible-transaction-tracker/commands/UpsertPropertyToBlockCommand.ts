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

const UpsertPropertyToBlockCommandArgsBaseSchema = z.object({
    blockUuid: LogseqUUIDSchema.describe("UUID of the Logseq block to update."),
    propertyUuidOrIndent: PropertyUuidOrIndentSchema,
    value: z.unknown().describe("Property value to set on the block.")
});

export const UpsertPropertyToBlockCommandArgsSchema = UpsertPropertyToBlockCommandArgsBaseSchema;

export type UpsertPropertyToBlockCommandArgsInput = z.input<
    typeof UpsertPropertyToBlockCommandArgsSchema
>;
export type UpsertPropertyToBlockCommandArgs = z.output<
    typeof UpsertPropertyToBlockCommandArgsSchema
>;

const UpsertPropertyToBlockCommandSerializedSchema =
    UpsertPropertyToBlockCommandArgsBaseSchema.extend({
        type: z.literal("UpsertPropertyToBlock")
    });

function isInternalUuidProperty(propertyKey: string): boolean {
    return propertyKey.replace(/^:/, "").split("/").at(-1) === "uuid";
}

/**
 * Sets a property value on a Logseq block.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - propertyKey
 * - previousValue
 */
export class UpsertPropertyToBlockCommand extends BaseReversibleCommand {
    private propertyKey: string | undefined;
    private previousValue: unknown;
    private hadPreviousValue = false;
    private previousValueSnapshotTaken = false;
    public readonly args: UpsertPropertyToBlockCommandArgs;

    public constructor(args: UpsertPropertyToBlockCommandArgsInput) {
        super();
        this.args = UpsertPropertyToBlockCommandArgsSchema.parse(args);
    }

    public async execute() {
        const property = await LogseqEditor.getProperty(this.args.propertyUuidOrIndent);
        if (!property) throw new Error("Property page not found");

        const originalBlock = await logseq.Editor.getBlock(this.args.blockUuid as BlockIdentity);
        if (!originalBlock) throw new Error(`Block not found: ${this.args.blockUuid}`);
        this.propertyKey = property.ident;
        try {
            this.previousValue = await LogseqBlockPropertyHelper.getBlockProperty(
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

        if (originalBlock.page) this.changedPages.push(await resolvePageUUID(originalBlock.page));

        await logseq.Editor.upsertBlockProperty(
            this.args.blockUuid,
            this.propertyKey,
            this.args.value,
            {reset: true}
        );

        const updatedBlock = await logseq.Editor.getBlock(this.args.blockUuid as BlockIdentity);
        if (!updatedBlock) throw new Error(`Updated block not found: ${this.args.blockUuid}`);
        return await normalizeBlock(updatedBlock);
    }

    public async revert(): Promise<void> {
        if (!this.propertyKey || !this.previousValueSnapshotTaken) {
            throw new Error("Execute must be called before revert");
        }

        if (this.hadPreviousValue) {
            await logseq.Editor.upsertBlockProperty(
                this.args.blockUuid,
                this.propertyKey,
                this.previousValue,
                {reset: true}
            );
            return;
        }

        await logseq.Editor.removeBlockProperty(this.args.blockUuid, this.propertyKey);
    }
}

export const UpsertPropertyToBlockCommandCodec = createReversibleCommandCodec({
    type: "UpsertPropertyToBlock",
    serializedSchema: UpsertPropertyToBlockCommandSerializedSchema,
    commandSchema: z.instanceof(UpsertPropertyToBlockCommand),
    decode: (args) => new UpsertPropertyToBlockCommand(args),
    encodeData: (command) => command.args
});
