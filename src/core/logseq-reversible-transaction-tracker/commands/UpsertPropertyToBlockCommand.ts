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

export const UpsertPropertyToBlockCommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    propertyKey: z.string().optional(),
    previousValue: z.unknown().optional(),
    hadPreviousValue: z.boolean().optional(),
    previousValueSnapshotTaken: z.boolean().default(false)
});
export type UpsertPropertyToBlockCommandState = z.output<
    typeof UpsertPropertyToBlockCommandStateSchema
>;

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
export class UpsertPropertyToBlockCommand extends BaseReversibleCommand<UpsertPropertyToBlockCommandState> {
    public readonly args: UpsertPropertyToBlockCommandArgs;

    public constructor(
        args: UpsertPropertyToBlockCommandArgsInput,
        commandState?: UpsertPropertyToBlockCommandState
    ) {
        super(
            UpsertPropertyToBlockCommandStateSchema.parse(
                commandState ?? {status: "new", previousValueSnapshotTaken: false}
            )
        );
        this.args = UpsertPropertyToBlockCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        const property = await LogseqEditor.getProperty(this.args.propertyUuidOrIndent);
        if (!property) throw new Error("Property page not found");

        const originalBlock = await logseq.Editor.getBlock(this.args.blockUuid as BlockIdentity);
        if (!originalBlock) throw new Error(`Block not found: ${this.args.blockUuid}`);
        this.commandState.propertyKey = property.ident;
        try {
            this.commandState.previousValue =
                await LogseqBlockPropertyHelper.getBlockPropertyInputValue(
                    this.args.blockUuid,
                    this.commandState.propertyKey
                );
            this.commandState.hadPreviousValue = true;
        } catch (error) {
            if (!(error instanceof LogseqBlockPropertyNotFoundError)) throw error;
            this.commandState.previousValue = undefined;
            this.commandState.hadPreviousValue = false;
        }
        this.commandState.previousValueSnapshotTaken = true;

        this.changedPages.push(await resolvePageUUID(originalBlock.page ?? originalBlock));

        await logseq.Editor.upsertBlockProperty(
            this.args.blockUuid,
            this.commandState.propertyKey,
            this.args.value,
            {reset: true}
        );

        const updatedBlock = await logseq.Editor.getBlock(this.args.blockUuid as BlockIdentity);
        if (!updatedBlock) throw new Error(`Updated block not found: ${this.args.blockUuid}`);
        this.commandState.status = "executed";
        return await normalizeBlock(updatedBlock);
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        const {propertyKey, previousValue, hadPreviousValue, previousValueSnapshotTaken} =
            this.commandState;
        if (!propertyKey || !previousValueSnapshotTaken) {
            throw new Error("Missing previous property value");
        }

        if (hadPreviousValue) {
            await logseq.Editor.upsertBlockProperty(
                this.args.blockUuid,
                propertyKey,
                previousValue,
                {reset: true}
            );
            this.commandState.status = "new";
            return;
        }

        await logseq.Editor.removeBlockProperty(this.args.blockUuid, propertyKey);
        this.commandState.status = "new";
    }
}

export const UpsertPropertyToBlockCommandCodec = createReversibleCommandCodec({
    type: "UpsertPropertyToBlock",
    argsSchema: UpsertPropertyToBlockCommandArgsSchema,
    commandStateSchema: UpsertPropertyToBlockCommandStateSchema,
    commandClass: UpsertPropertyToBlockCommand
});
