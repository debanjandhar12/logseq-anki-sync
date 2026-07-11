import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {normalizeTagPage} from "./utils/normalizeTagPage";
import {requireTagWithoutProperty} from "./utils/validations/tagValidations";

const AddPropertyToTagPageCommandArgsBaseSchema = z.object({
    tagPageUuid: LogseqUUIDSchema.describe("UUID of the Logseq tag page."),
    propertyPageUuid: LogseqUUIDSchema.describe("UUID of the Logseq property page to add.")
});

export const AddPropertyToTagPageCommandArgsSchema = AddPropertyToTagPageCommandArgsBaseSchema;
export type AddPropertyToTagPageCommandArgsInput = z.input<
    typeof AddPropertyToTagPageCommandArgsSchema
>;
export type AddPropertyToTagPageCommandArgs = z.output<
    typeof AddPropertyToTagPageCommandArgsSchema
>;

const AddPropertyToTagPageCommandSerializedSchema =
    AddPropertyToTagPageCommandArgsBaseSchema.extend({type: z.literal("AddPropertyToTagPage")});

export class AddPropertyToTagPageCommand extends BaseReversibleCommand {
    private executed = false;
    public readonly args: AddPropertyToTagPageCommandArgs;

    public constructor(args: AddPropertyToTagPageCommandArgsInput) {
        super();
        this.args = AddPropertyToTagPageCommandArgsSchema.parse(args);
    }

    public async execute() {
        await requireTagWithoutProperty(this.args.tagPageUuid, this.args.propertyPageUuid);
        await logseq.Editor.addTagProperty(this.args.tagPageUuid, this.args.propertyPageUuid);
        this.executed = true;
        this.changedPages.push(this.args.tagPageUuid);
        const updatedTag = await logseq.Editor.getTag(this.args.tagPageUuid);
        if (!updatedTag) throw new Error(`Updated tag page not found: ${this.args.tagPageUuid}`);
        return await normalizeTagPage(updatedTag);
    }

    public async revert(): Promise<void> {
        if (!this.executed) throw new Error("Execute must be called before revert");
        await logseq.Editor.removeTagProperty(this.args.tagPageUuid, this.args.propertyPageUuid);
        this.executed = false;
    }
}

export const AddPropertyToTagPageCommandCodec = createReversibleCommandCodec({
    type: "AddPropertyToTagPage",
    serializedSchema: AddPropertyToTagPageCommandSerializedSchema,
    commandSchema: z.instanceof(AddPropertyToTagPageCommand),
    decode: (args) => new AddPropertyToTagPageCommand(args),
    encodeData: (command) => command.args
});
