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

export const AddPropertyToTagPageCommandStateSchema = z.object({
    status: z.enum(["new", "executed"])
});
export type AddPropertyToTagPageCommandState = z.output<
    typeof AddPropertyToTagPageCommandStateSchema
>;

export class AddPropertyToTagPageCommand extends BaseReversibleCommand<AddPropertyToTagPageCommandState> {
    public readonly args: AddPropertyToTagPageCommandArgs;

    public constructor(
        args: AddPropertyToTagPageCommandArgsInput,
        commandState?: AddPropertyToTagPageCommandState
    ) {
        super(AddPropertyToTagPageCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = AddPropertyToTagPageCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        await requireTagWithoutProperty(this.args.tagPageUuid, this.args.propertyPageUuid);
        await logseq.Editor.addTagProperty(this.args.tagPageUuid, this.args.propertyPageUuid);
        this.changedPages.push(this.args.tagPageUuid);
        const updatedTag = await logseq.Editor.getTag(this.args.tagPageUuid);
        if (!updatedTag) throw new Error(`Updated tag page not found: ${this.args.tagPageUuid}`);
        const tag = await normalizeTagPage(updatedTag);
        this.commandState.status = "executed";
        return tag;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        await logseq.Editor.removeTagProperty(this.args.tagPageUuid, this.args.propertyPageUuid);
        this.commandState.status = "new";
    }
}

export const AddPropertyToTagPageCommandCodec = createReversibleCommandCodec({
    type: "AddPropertyToTagPage",
    argsSchema: AddPropertyToTagPageCommandArgsSchema,
    commandStateSchema: AddPropertyToTagPageCommandStateSchema,
    commandClass: AddPropertyToTagPageCommand
});
