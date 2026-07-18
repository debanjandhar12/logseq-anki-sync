import type {BlockIdentity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {isPageSoftDeleted} from "./utils/isPageSoftDeleted";
import {requireActivePage} from "./utils/validations";

export const DeletePageCommandArgsSchema = z.object({
    pageUuid: LogseqUUIDSchema.describe("UUID of the Logseq page to delete.")
});

export type DeletePageCommandArgsInput = z.input<typeof DeletePageCommandArgsSchema>;
export type DeletePageCommandArgs = z.output<typeof DeletePageCommandArgsSchema>;

export const DeletePageCommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    pageName: z.string().optional()
});
export type DeletePageCommandState = z.output<typeof DeletePageCommandStateSchema>;

/**
 * Deletes a Logseq page.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - deletedPage
 */
export class DeletePageCommand extends BaseReversibleCommand<DeletePageCommandState> {
    public readonly args: DeletePageCommandArgs;

    public constructor(args: DeletePageCommandArgsInput, commandState?: DeletePageCommandState) {
        super(DeletePageCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = DeletePageCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        const block = await logseq.Editor.getBlock(this.args.pageUuid as BlockIdentity);
        const isPageBlock = block ? await LogseqEditor.isPageBlock(block) : false;
        if (block && isPageBlock !== true && !("name" in block && typeof block.name === "string")) {
            throw new Error("Cannot delete a block. Page UUID provided must be that of a page.");
        }

        const page = await requireActivePage(this.args.pageUuid as PageIdentity);

        if (await LogseqEditor.isTagBlock(page.uuid)) {
            throw new Error("Cannot delete a tag page using DeletePageCommand.");
        }

        if (await LogseqEditor.isPropertyBlock(page.uuid)) {
            throw new Error("Cannot delete a property page using DeletePageCommand.");
        }

        this.commandState.pageName = page.originalName ?? page.name;
        this.changedPages.push(page.uuid);
        await logseq.Editor.deletePage(page.uuid);
        this.commandState.status = "executed";
        return true;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        const pageName = this.commandState.pageName ?? this.args.pageUuid;
        const existingPage = await logseq.Editor.getPage(this.args.pageUuid);
        if (existingPage && !isPageSoftDeleted(existingPage)) {
            throw new Error(`Page already exists: ${pageName}`);
        }

        // @ts-ignore restorePage exists in unreleased Logseq APIs but is not in current plugin types.
        await logseq.Editor.restorePage(this.args.pageUuid);
        this.commandState.status = "new";
    }
}

export const DeletePageCommandCodec = createReversibleCommandCodec({
    type: "DeletePage",
    argsSchema: DeletePageCommandArgsSchema,
    commandStateSchema: DeletePageCommandStateSchema,
    commandClass: DeletePageCommand
});
