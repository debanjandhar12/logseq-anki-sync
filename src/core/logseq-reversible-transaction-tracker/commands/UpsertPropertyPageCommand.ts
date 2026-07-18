import type {PropertySchema} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {snapshotPagePropertiesSchema} from "./utils/snapshotPagePropertiesSchema";
import {PropertyUuidOrIndentSchema} from "./utils/validations/propertyValidations";

const PropertySchemaInputSchema = z
    .object({
        type: z.string().optional(),
        cardinality: z.enum(["one", "many"]).optional(),
        hide: z.boolean().optional(),
        public: z.boolean().optional()
    })
    .passthrough();

const UpsertPropertyPageCommandArgsBaseSchema = z.object({
    propertyUuidOrIndent: PropertyUuidOrIndentSchema,
    schema: PropertySchemaInputSchema.optional().describe("Optional Logseq property schema."),
    opts: z
        .object({
            name: z.string().optional()
        })
        .optional()
        .describe("Optional property page options.")
});

export const UpsertPropertyPageCommandArgsSchema = UpsertPropertyPageCommandArgsBaseSchema;

export type UpsertPropertyPageCommandArgsInput = z.input<
    typeof UpsertPropertyPageCommandArgsSchema
>;
export type UpsertPropertyPageCommandArgs = z.output<typeof UpsertPropertyPageCommandArgsSchema>;

const PagePropertiesSchemaSnapshotSchema = z.object({
    propertyIndent: z.string(),
    propertyIdent: z.string().optional(),
    schema: PropertySchemaInputSchema.optional(),
    opts: z.object({name: z.string().optional()}).optional()
});

export const UpsertPropertyPageCommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    propertyIndent: z.string().optional(),
    originalProperty: PagePropertiesSchemaSnapshotSchema.nullable().optional()
});
export type UpsertPropertyPageCommandState = z.output<typeof UpsertPropertyPageCommandStateSchema>;

/**
 * Creates or updates a Logseq property page/schema.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - originalProperty
 */
export class UpsertPropertyPageCommand extends BaseReversibleCommand<UpsertPropertyPageCommandState> {
    public readonly args: UpsertPropertyPageCommandArgs;

    public constructor(
        args: UpsertPropertyPageCommandArgsInput,
        commandState?: UpsertPropertyPageCommandState
    ) {
        super(UpsertPropertyPageCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = UpsertPropertyPageCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        const existingProperty = await LogseqEditor.getProperty(this.args.propertyUuidOrIndent);
        this.commandState.originalProperty = existingProperty
            ? snapshotPagePropertiesSchema(existingProperty)
            : null;
        this.commandState.propertyIndent =
            this.commandState.originalProperty?.propertyIndent ?? this.args.propertyUuidOrIndent;
        if (!this.commandState.propertyIndent) {
            throw new Error("propertyIndent is required when creating a property page.");
        }

        await logseq.Editor.upsertProperty(
            this.commandState.propertyIndent,
            this.args.schema as Partial<PropertySchema> | undefined,
            this.args.opts
        );

        const property = await LogseqEditor.getProperty(this.commandState.propertyIndent);
        if (property?.uuid) this.changedPages.push(property.uuid);
        this.commandState.status = "executed";
        return property;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        const {originalProperty, propertyIndent} = this.commandState;
        if (originalProperty === undefined) throw new Error("Missing original property state");

        if (!originalProperty) {
            if (!propertyIndent) throw new Error("Missing property indent");
            await logseq.Editor.removeProperty(propertyIndent);
            this.commandState.status = "new";
            return;
        }

        await logseq.Editor.upsertProperty(
            originalProperty.propertyIndent,
            originalProperty.schema as Partial<PropertySchema> | undefined,
            originalProperty.opts
        );
        this.commandState.status = "new";
    }
}

export const UpsertPropertyPageCommandCodec = createReversibleCommandCodec({
    type: "UpsertPropertyPage",
    argsSchema: UpsertPropertyPageCommandArgsSchema,
    commandStateSchema: UpsertPropertyPageCommandStateSchema,
    commandClass: UpsertPropertyPageCommand
});
