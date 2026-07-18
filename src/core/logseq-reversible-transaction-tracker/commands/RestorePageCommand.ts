import type {BlockIdentity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {isPageSoftDeleted} from "./utils/isPageSoftDeleted";
import {normalizePage} from "./utils/normalizePage";
import {requireExistingPage} from "./utils/validations";

export const RestorePageCommandArgsSchema = z.object({
    pageUuid: LogseqUUIDSchema.describe("UUID of the soft-deleted Logseq page to restore.")
});

export type RestorePageCommandArgsInput = z.input<typeof RestorePageCommandArgsSchema>;
export type RestorePageCommandArgs = z.output<typeof RestorePageCommandArgsSchema>;

export const RestorePageCommandStateSchema = z.object({
    status: z.enum(["new", "executed"])
});
export type RestorePageCommandState = z.output<typeof RestorePageCommandStateSchema>;

/**
 * Restores a soft-deleted Logseq page.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - none
 */
export class RestorePageCommand extends BaseReversibleCommand<RestorePageCommandState> {
    public readonly args: RestorePageCommandArgs;

    public constructor(args: RestorePageCommandArgsInput, commandState?: RestorePageCommandState) {
        super(RestorePageCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = RestorePageCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        const block = await logseq.Editor.getBlock(this.args.pageUuid as BlockIdentity);
        const isPageBlock = block ? await LogseqEditor.isPageBlock(block) : false;
        if (block && isPageBlock !== true && !("name" in block && typeof block.name === "string")) {
            throw new Error("Cannot restore a block. Page UUID provided must be that of a page.");
        }

        const page = await requireExistingPage(this.args.pageUuid as PageIdentity);
        if (!isPageSoftDeleted(page)) {
            throw new Error(`Page is not deleted: ${JSON.stringify(this.args.pageUuid)}`);
        }

        // @ts-ignore restorePage exists in unreleased Logseq APIs but is not in current plugin types.
        await logseq.Editor.restorePage(page.uuid);

        const rawPage = await logseq.Editor.getPage(page.uuid);
        if (!rawPage)
            throw new Error(`Logseq failed to restore page: ${JSON.stringify(this.args.pageUuid)}`);

        const restoredPage = await normalizePage(rawPage);
        this.changedPages.push(restoredPage.uuid);
        this.commandState.status = "executed";
        return restoredPage;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        const page = await logseq.Editor.getPage(this.args.pageUuid);
        if (page && !isPageSoftDeleted(page)) await logseq.Editor.deletePage(this.args.pageUuid);
        this.commandState.status = "new";
    }
}

export const RestorePageCommandCodec = createReversibleCommandCodec({
    type: "RestorePage",
    argsSchema: RestorePageCommandArgsSchema,
    commandStateSchema: RestorePageCommandStateSchema,
    commandClass: RestorePageCommand
});
