import {isPageSoftDeleted} from "src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";
import {v4 as uuidv4} from "uuid";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {normalizePage} from "./utils/normalizePage";

export const CreatePageCommandArgsSchema = z.object({
    pageName: z.string().describe("Name of the Logseq page to create.")
});

export type CreatePageCommandArgs = z.infer<typeof CreatePageCommandArgsSchema>;

const CreatePageCommandDataSchema = CreatePageCommandArgsSchema.extend({
    type: z.literal("CreatePage"),
    pageUuid: LogseqUUIDSchema
});

type CreatePageCommandState = Pick<z.infer<typeof CreatePageCommandDataSchema>, "pageUuid">;

export class CreatePageCommand extends BaseReversibleCommand {
    private readonly pageUuid: string;
    public readonly args: CreatePageCommandArgs;

    public constructor(args: CreatePageCommandArgs, state?: Partial<CreatePageCommandState>) {
        super();
        this.args = CreatePageCommandArgsSchema.parse(args);
        this.pageUuid = LogseqUUIDSchema.parse(state?.pageUuid ?? uuidv4());
    }

    public async execute() {
        const existingPage = await logseq.Editor.getPage(this.args.pageName);
        if (existingPage) {
            const page = await normalizePage(existingPage);
            if (page.uuid !== this.pageUuid) {
                if (!isPageSoftDeleted(page))
                    throw new Error(`Page already exists: ${this.args.pageName}`);
                throw new Error(`Page already exists as deleted: ${this.args.pageName}`);
            }

            if (!isPageSoftDeleted(page)) {
                this.changedPages.push(page.uuid);
                return page;
            }

            // @ts-ignore restorePage exists in unreleased Logseq APIs but is not in current plugin types.
            await logseq.Editor.restorePage(page.uuid);

            const rawPage = await logseq.Editor.getPage(page.uuid);
            if (!rawPage) throw new Error(`Logseq failed to restore page: ${this.args.pageName}`);

            const restoredPage = await normalizePage(rawPage);
            this.changedPages.push(restoredPage.uuid);
            return restoredPage;
        }

        const rawPage = await logseq.Editor.createPage(this.args.pageName, undefined, {
            redirect: false,
            customUUID: this.pageUuid,
            createFirstBlock: false
        });
        if (!rawPage) throw new Error(`Logseq failed to create page: ${this.args.pageName}`);

        const page = await normalizePage(rawPage);
        this.changedPages.push(page.uuid);
        return page;
    }

    public async revert(): Promise<void> {
        const page = await logseq.Editor.getPage(this.pageUuid);
        if (!page) throw new Error(`Created page is missing: ${this.pageUuid}`);
        if (isPageSoftDeleted(page)) return;

        await logseq.Editor.deletePage(this.pageUuid);
    }

    public getState(): CreatePageCommandState {
        return {
            pageUuid: this.pageUuid
        };
    }
}

export const CreatePageCommandCodec = z.codec(
    CreatePageCommandDataSchema,
    z.instanceof(CreatePageCommand),
    {
        decode: ({type: _, pageUuid, ...args}) => new CreatePageCommand(args, {pageUuid}),
        encode: (command) => ({
            type: "CreatePage" as const,
            ...command.args,
            ...command.getState()
        })
    }
);
