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

export const CreateTagPageCommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    tagPageUuid: LogseqUUIDSchema
});
export type CreateTagPageCommandState = z.output<typeof CreateTagPageCommandStateSchema>;

/** Creates a Logseq tag page with a stable UUID. */
export class CreateTagPageCommand extends BaseReversibleCommand<CreateTagPageCommandState> {
    public readonly args: CreateTagPageCommandArgs;

    public constructor(
        args: CreateTagPageCommandArgsInput,
        commandState?: CreateTagPageCommandState
    ) {
        super(
            CreateTagPageCommandStateSchema.parse(
                commandState ?? {status: "new", tagPageUuid: uuidv4()}
            )
        );
        this.args = CreateTagPageCommandArgsSchema.parse(args);
    }

    public get tagPageUuid(): string {
        return this.commandState.tagPageUuid;
    }

    public async execute() {
        this.assertCanExecute();
        const existingTag = await logseq.Editor.getTag(this.args.tagName);
        if (existingTag) {
            const tag = await normalizeTagPage(existingTag);
            if (tag.uuid !== this.tagPageUuid) {
                throw new Error(`Tag page already exists: ${this.args.tagName}`);
            }

            this.changedPages.push(tag.uuid);
            this.commandState.status = "executed";
            return tag;
        }

        const createdTag = await logseq.Editor.createTag(this.args.tagName, {
            uuid: this.tagPageUuid
        });
        if (!createdTag) throw new Error(`Failed to create tag page: ${this.args.tagName}`);

        const normalizedTag = await normalizeTagPage(createdTag);
        this.changedPages.push(normalizedTag.uuid);
        this.commandState.status = "executed";
        return normalizedTag;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        const tag = await logseq.Editor.getTag(this.tagPageUuid);
        if (!tag) throw new Error(`Created tag page is missing: ${this.tagPageUuid}`);
        await logseq.Editor.deletePage(this.tagPageUuid);
        this.commandState.status = "new";
    }
}

export const CreateTagPageCommandCodec = createReversibleCommandCodec({
    type: "CreateTagPage",
    argsSchema: CreateTagPageCommandArgsSchema,
    commandStateSchema: CreateTagPageCommandStateSchema,
    commandClass: CreateTagPageCommand
});
