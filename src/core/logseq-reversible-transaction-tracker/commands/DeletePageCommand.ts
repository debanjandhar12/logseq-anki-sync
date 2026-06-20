import type {PageEntity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import {z} from "zod";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {isDeletedPage} from "./utils/isDeletedPage";

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

    public async execute(_deterministicUUIDGenerator: DeterministicUUIDGenerator) {
        const page = await LogseqPropertiesHelper.getPage(this.args.pageUuid as PageIdentity);
        if (!page?.name || isDeletedPage(page)) {
            throw new Error(`Page not found: ${JSON.stringify(this.args.pageUuid)}`);
        }

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
        if (existingPage && !isDeletedPage(existingPage)) {
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
