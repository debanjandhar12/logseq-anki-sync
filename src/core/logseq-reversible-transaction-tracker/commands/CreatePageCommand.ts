import {isPageSoftDeleted} from "src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";
import {v4 as uuidv4} from "uuid";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {normalizePage} from "./utils/normalizePage";

export const CreatePageCommandArgsSchema = z.object({
    pageName: z.string().describe("Name of the Logseq page to create.")
});

export type CreatePageCommandArgsInput = z.input<typeof CreatePageCommandArgsSchema>;
export type CreatePageCommandArgs = z.output<typeof CreatePageCommandArgsSchema>;

export const CreatePageCommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    pageUuid: LogseqUUIDSchema
});
export type CreatePageCommandState = z.output<typeof CreatePageCommandStateSchema>;

/**
 * Creates a Logseq page with a stable UUID.
 *
 * Serialized data:
 * - args
 * - pageUuid
 *
 * Runtime-only data:
 * - none
 */
export class CreatePageCommand extends BaseReversibleCommand<CreatePageCommandState> {
    public readonly args: CreatePageCommandArgs;

    public constructor(args: CreatePageCommandArgsInput, commandState?: CreatePageCommandState) {
        super(
            CreatePageCommandStateSchema.parse(commandState ?? {status: "new", pageUuid: uuidv4()})
        );
        this.args = CreatePageCommandArgsSchema.parse(args);
    }

    public get pageUuid(): string {
        return this.commandState.pageUuid;
    }

    public async execute() {
        this.assertCanExecute();
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
                this.commandState.status = "executed";
                return page;
            }

            // @ts-ignore restorePage exists in unreleased Logseq APIs but is not in current plugin types.
            await logseq.Editor.restorePage(page.uuid);

            const rawPage = await logseq.Editor.getPage(page.uuid);
            if (!rawPage) throw new Error(`Logseq failed to restore page: ${this.args.pageName}`);

            const restoredPage = await normalizePage(rawPage);
            this.changedPages.push(restoredPage.uuid);
            this.commandState.status = "executed";
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
        this.commandState.status = "executed";
        return page;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        const page = await logseq.Editor.getPage(this.pageUuid);
        if (!page) throw new Error(`Created page is missing: ${this.pageUuid}`);
        if (!isPageSoftDeleted(page)) await logseq.Editor.deletePage(this.pageUuid);

        this.commandState.status = "new";
    }
}

export const CreatePageCommandCodec = createReversibleCommandCodec({
    type: "CreatePage",
    argsSchema: CreatePageCommandArgsSchema,
    commandStateSchema: CreatePageCommandStateSchema,
    commandClass: CreatePageCommand
});
