import {v4 as uuidv4} from "uuid";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {normalizeTagPage} from "./utils/normalizeTagPage";

const CreateTagPageCommandArgsBaseSchema = z.object({
    tagName: z.string().trim().min(1).describe("Name of the Logseq tag to create.")
});

export const CreateTagPageCommandArgsSchema = CreateTagPageCommandArgsBaseSchema;
export type CreateTagPageCommandArgsInput = z.input<typeof CreateTagPageCommandArgsSchema>;
export type CreateTagPageCommandArgs = z.output<typeof CreateTagPageCommandArgsSchema>;

const CreateTagPageCommandSerializedSchema = CreateTagPageCommandArgsBaseSchema.extend({
    type: z.literal("CreateTagPage"),
    tagPageUuid: LogseqUUIDSchema
});

export type CreateTagPageCommandSerializedState = Omit<
    z.output<typeof CreateTagPageCommandSerializedSchema>,
    "type" | keyof CreateTagPageCommandArgs
>;

/** Creates a Logseq tag page with a stable UUID. */
export class CreateTagPageCommand extends BaseReversibleCommand {
    private createdTagPageUuid: string | undefined;
    public readonly args: CreateTagPageCommandArgs;
    public readonly tagPageUuid: string;

    public constructor(
        args: CreateTagPageCommandArgsInput,
        serializedState?: Partial<CreateTagPageCommandSerializedState>
    ) {
        super();
        this.args = CreateTagPageCommandArgsSchema.parse(args);
        this.tagPageUuid = LogseqUUIDSchema.parse(serializedState?.tagPageUuid ?? uuidv4());
    }

    public async execute() {
        const existingTag = await logseq.Editor.getTag(this.args.tagName);
        if (existingTag) {
            const tag = await normalizeTagPage(existingTag);
            if (tag.uuid !== this.tagPageUuid) {
                throw new Error(`Tag page already exists: ${this.args.tagName}`);
            }

            this.createdTagPageUuid = tag.uuid;
            this.changedPages.push(tag.uuid);
            return tag;
        }

        const createdTag = await logseq.Editor.createTag(this.args.tagName, {
            uuid: this.tagPageUuid
        });
        if (!createdTag) throw new Error(`Failed to create tag page: ${this.args.tagName}`);

        const normalizedTag = await normalizeTagPage(createdTag);
        this.createdTagPageUuid = normalizedTag.uuid;
        this.changedPages.push(normalizedTag.uuid);
        return normalizedTag;
    }

    public async revert(): Promise<void> {
        if (!this.createdTagPageUuid) throw new Error("Execute must be called before revert");
        const tag = await logseq.Editor.getTag(this.createdTagPageUuid);
        if (!tag) throw new Error(`Created tag page is missing: ${this.createdTagPageUuid}`);
        await logseq.Editor.deletePage(this.createdTagPageUuid);
    }
}

export const CreateTagPageCommandCodec = createReversibleCommandCodec({
    type: "CreateTagPage",
    serializedSchema: CreateTagPageCommandSerializedSchema,
    commandSchema: z.instanceof(CreateTagPageCommand),
    decode: ({tagPageUuid, ...args}) => new CreateTagPageCommand(args, {tagPageUuid}),
    encodeData: (command) => ({...command.args, tagPageUuid: command.tagPageUuid})
});
