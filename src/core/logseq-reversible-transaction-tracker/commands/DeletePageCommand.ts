import type {BlockIdentity, PageEntity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {isPageSoftDeleted} from "./utils/isPageSoftDeleted";
import {requireActivePage} from "./utils/validations";

export const DeletePageCommandArgsSchema = z.object({
    pageUuid: LogseqUUIDSchema.describe("UUID of the Logseq page to delete.")
});

export type DeletePageCommandArgs = z.infer<typeof DeletePageCommandArgsSchema>;

const DeletePageCommandDataSchema = DeletePageCommandArgsSchema.extend({
    type: z.literal("DeletePage")
});

export class DeletePageCommand extends BaseReversibleCommand {
    private deletedPage: PageEntity | undefined;
    public readonly args: DeletePageCommandArgs;

    public constructor(args: DeletePageCommandArgs) {
        super();
        this.args = DeletePageCommandArgsSchema.parse(args);
    }

    public async execute() {
        const block = await logseq.Editor.getBlock(this.args.pageUuid as BlockIdentity);
        const isPageBlock = block ? await logseq.Editor.isPageBlock(block) : false;
        if (block && isPageBlock !== true && !("name" in block && typeof block.name === "string")) {
            throw new Error("Cannot delete a block. Page UUID provided must be that of a page.");
        }

        const page = await requireActivePage(this.args.pageUuid as PageIdentity);

        this.deletedPage = page;
        this.changedPages.push(page.uuid);
        await logseq.Editor.deletePage(page.uuid);
        return true;
    }

    public async revert(): Promise<void> {
        if (!this.deletedPage) throw new Error("Execute must be called before revert");

        const page = this.deletedPage;
        const pageName = page.originalName ?? page.name;
        const existingPage = await logseq.Editor.getPage(page.uuid);
        if (existingPage && !isPageSoftDeleted(existingPage)) {
            throw new Error(`Page already exists: ${pageName}`);
        }

        // @ts-ignore restorePage exists in unreleased Logseq APIs but is not in current plugin types.
        await logseq.Editor.restorePage(page.uuid);
    }
}

export const DeletePageCommandCodec = z.codec(
    DeletePageCommandDataSchema,
    z.instanceof(DeletePageCommand),
    {
        decode: ({type: _, ...args}) => new DeletePageCommand(args),
        encode: (command) => ({type: "DeletePage" as const, ...command.args})
    }
);
