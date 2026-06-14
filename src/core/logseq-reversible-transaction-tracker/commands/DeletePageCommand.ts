import type {BlockEntity, EntityID, PageEntity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import {z} from "zod";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {LogseqIdentitySchema} from "./schemas";

export const DeletePageCommandArgsSchema = z.object({
    pageUuid: LogseqIdentitySchema.describe("Page identity to delete.")
});

export type DeletePageCommandArgs = z.infer<typeof DeletePageCommandArgsSchema>;

const DeletePageCommandDataSchema = DeletePageCommandArgsSchema.extend({
    type: z.literal("DeletePage")
});

export class DeletePageCommand extends BaseReversibleCommand {
    private deletedPageSnapshot: DeletedPageSnapshot | undefined;

    public constructor(public readonly args: DeletePageCommandArgs) {
        super();
    }

    public async execute(_deterministicUUIDGenerator: DeterministicUUIDGenerator) {
        const page = await LogseqPropertiesHelper.getPage(
            this.args.pageUuid as PageIdentity | EntityID
        );
        if (!page?.name) throw new Error(`Page not found: ${JSON.stringify(this.args.pageUuid)}`);

        this.deletedPageSnapshot = {
            page,
            blocks: await LogseqPropertiesHelper.getPageBlocksTree(page.uuid)
        };
        this.changedPages.push(page.uuid);
        await logseq.Editor.deletePage(page.name);
        return true;
    }

    public async revert(): Promise<void> {
        if (!this.deletedPageSnapshot) throw new Error("Execute must be called before revert");

        const {page, blocks} = this.deletedPageSnapshot;
        const pageName = page.originalName ?? page.name;
        const existingPage = await logseq.Editor.getPage(page.uuid);
        if (existingPage) throw new Error(`Page already exists: ${pageName}`);

        const restoredPage = await logseq.Editor.createPage(pageName, undefined, {
            redirect: false,
            customUUID: page.uuid
        });
        if (!restoredPage) throw new Error(`Logseq failed to restore page: ${pageName}`);

        for (const block of blocks) await restoreBlockTree(page.uuid, block);
    }
}

type DeletedPageSnapshot = {
    page: PageEntity;
    blocks: BlockEntity[];
};

async function restoreBlockTree(parentUuid: string, block: BlockEntity): Promise<void> {
    const restoredBlock = await logseq.Editor.insertBlock(parentUuid, block.content ?? "", {
        customUUID: block.uuid,
        sibling: false,
        end: true
    });
    if (!restoredBlock) throw new Error(`Logseq failed to restore block: ${block.uuid}`);

    for (const child of block.children ?? []) {
        if (Array.isArray(child)) continue;
        await restoreBlockTree(block.uuid, child);
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
