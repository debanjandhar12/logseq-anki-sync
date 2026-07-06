import type {PropertySchema} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {
    type PagePropertiesSchemaSnapshot,
    snapshotPagePropertiesSchema
} from "./utils/snapshotPagePropertiesSchema";
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

const UpsertPropertyPageCommandSerializedSchema = UpsertPropertyPageCommandArgsBaseSchema.extend({
    type: z.literal("UpsertPropertyPage")
});

/**
 * Creates or updates a Logseq property page/schema.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - originalProperty
 */
export class UpsertPropertyPageCommand extends BaseReversibleCommand {
    private propertyIndent: string | undefined;
    private originalProperty: PagePropertiesSchemaSnapshot | null | undefined;
    public readonly args: UpsertPropertyPageCommandArgs;

    public constructor(args: UpsertPropertyPageCommandArgsInput) {
        super();
        this.args = UpsertPropertyPageCommandArgsSchema.parse(args);
    }

    public async execute() {
        const existingProperty = await LogseqEditor.getProperty(this.args.propertyUuidOrIndent);
        this.originalProperty = existingProperty
            ? snapshotPagePropertiesSchema(existingProperty)
            : null;
        this.propertyIndent =
            this.originalProperty?.propertyIndent ?? this.args.propertyUuidOrIndent;
        if (!this.propertyIndent) {
            throw new Error("propertyIndent is required when creating a property page.");
        }

        await logseq.Editor.upsertProperty(
            this.propertyIndent,
            this.args.schema as Partial<PropertySchema> | undefined,
            this.args.opts
        );

        const property = await LogseqEditor.getProperty(this.propertyIndent);
        if (property?.uuid) this.changedPages.push(property.uuid);
        return property;
    }

    public async revert(): Promise<void> {
        if (this.originalProperty === undefined)
            throw new Error("Execute must be called before revert");

        if (!this.originalProperty) {
            if (!this.propertyIndent) throw new Error("Execute must be called before revert");
            await logseq.Editor.removeProperty(this.propertyIndent);
            return;
        }

        await logseq.Editor.upsertProperty(
            this.originalProperty.propertyIndent,
            this.originalProperty.schema,
            this.originalProperty.opts
        );
    }
}

export const UpsertPropertyPageCommandCodec = createReversibleCommandCodec({
    type: "UpsertPropertyPage",
    serializedSchema: UpsertPropertyPageCommandSerializedSchema,
    commandSchema: z.instanceof(UpsertPropertyPageCommand),
    decode: (args) => new UpsertPropertyPageCommand(args),
    encodeData: (command) => command.args
});
