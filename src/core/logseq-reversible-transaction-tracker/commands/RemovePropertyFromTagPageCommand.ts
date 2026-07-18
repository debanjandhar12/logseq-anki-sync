import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {normalizeTagPage} from "./utils/normalizeTagPage";
import {requireTagWithProperty} from "./utils/validations/tagValidations";

const RemovePropertyFromTagPageCommandArgsBaseSchema = z.object({
    tagPageUuid: LogseqUUIDSchema.describe("UUID of the Logseq tag page."),
    propertyPageUuid: LogseqUUIDSchema.describe("UUID of the Logseq property page to remove.")
});

export const RemovePropertyFromTagPageCommandArgsSchema =
    RemovePropertyFromTagPageCommandArgsBaseSchema;
export type RemovePropertyFromTagPageCommandArgsInput = z.input<
    typeof RemovePropertyFromTagPageCommandArgsSchema
>;
export type RemovePropertyFromTagPageCommandArgs = z.output<
    typeof RemovePropertyFromTagPageCommandArgsSchema
>;

export const RemovePropertyFromTagPageCommandStateSchema = z.object({
    status: z.enum(["new", "executed"])
});
export type RemovePropertyFromTagPageCommandState = z.output<
    typeof RemovePropertyFromTagPageCommandStateSchema
>;

export class RemovePropertyFromTagPageCommand extends BaseReversibleCommand<RemovePropertyFromTagPageCommandState> {
    public readonly args: RemovePropertyFromTagPageCommandArgs;

    public constructor(
        args: RemovePropertyFromTagPageCommandArgsInput,
        commandState?: RemovePropertyFromTagPageCommandState
    ) {
        super(RemovePropertyFromTagPageCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = RemovePropertyFromTagPageCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        await requireTagWithProperty(this.args.tagPageUuid, this.args.propertyPageUuid);
        await logseq.Editor.removeTagProperty(this.args.tagPageUuid, this.args.propertyPageUuid);
        this.changedPages.push(this.args.tagPageUuid);
        const updatedTag = await logseq.Editor.getTag(this.args.tagPageUuid);
        if (!updatedTag) throw new Error(`Updated tag page not found: ${this.args.tagPageUuid}`);
        const tag = await normalizeTagPage(updatedTag);
        this.commandState.status = "executed";
        return tag;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        await logseq.Editor.addTagProperty(this.args.tagPageUuid, this.args.propertyPageUuid);
        this.commandState.status = "new";
    }
}

export const RemovePropertyFromTagPageCommandCodec = createReversibleCommandCodec({
    type: "RemovePropertyFromTagPage",
    argsSchema: RemovePropertyFromTagPageCommandArgsSchema,
    commandStateSchema: RemovePropertyFromTagPageCommandStateSchema,
    commandClass: RemovePropertyFromTagPageCommand
});
