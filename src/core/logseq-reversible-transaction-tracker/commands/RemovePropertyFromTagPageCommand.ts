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

const RemovePropertyFromTagPageCommandSerializedSchema =
    RemovePropertyFromTagPageCommandArgsBaseSchema.extend({
        type: z.literal("RemovePropertyFromTagPage")
    });

export class RemovePropertyFromTagPageCommand extends BaseReversibleCommand {
    private executed = false;
    public readonly args: RemovePropertyFromTagPageCommandArgs;

    public constructor(args: RemovePropertyFromTagPageCommandArgsInput) {
        super();
        this.args = RemovePropertyFromTagPageCommandArgsSchema.parse(args);
    }

    public async execute() {
        await requireTagWithProperty(this.args.tagPageUuid, this.args.propertyPageUuid);
        await logseq.Editor.removeTagProperty(this.args.tagPageUuid, this.args.propertyPageUuid);
        this.executed = true;
        this.changedPages.push(this.args.tagPageUuid);
        const updatedTag = await logseq.Editor.getTag(this.args.tagPageUuid);
        if (!updatedTag) throw new Error(`Updated tag page not found: ${this.args.tagPageUuid}`);
        return await normalizeTagPage(updatedTag);
    }

    public async revert(): Promise<void> {
        if (!this.executed) throw new Error("Execute must be called before revert");
        await logseq.Editor.addTagProperty(this.args.tagPageUuid, this.args.propertyPageUuid);
        this.executed = false;
    }
}

export const RemovePropertyFromTagPageCommandCodec = createReversibleCommandCodec({
    type: "RemovePropertyFromTagPage",
    serializedSchema: RemovePropertyFromTagPageCommandSerializedSchema,
    commandSchema: z.instanceof(RemovePropertyFromTagPageCommand),
    decode: (args) => new RemovePropertyFromTagPageCommand(args),
    encodeData: (command) => command.args
});
