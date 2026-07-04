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

const RestorePageCommandSerializedSchema = RestorePageCommandArgsSchema.extend({
    type: z.literal("RestorePage")
});

export type RestorePageCommandSerializedState = Omit<
    z.output<typeof RestorePageCommandSerializedSchema>,
    "type" | keyof RestorePageCommandArgs
>;

/**
 * Restores a soft-deleted Logseq page.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - none
 */
export class RestorePageCommand extends BaseReversibleCommand {
    public readonly args: RestorePageCommandArgs;

    public constructor(args: RestorePageCommandArgsInput) {
        super();
        this.args = RestorePageCommandArgsSchema.parse(args);
    }

    public async execute() {
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
        return restoredPage;
    }

    public async revert(): Promise<void> {
        const page = await logseq.Editor.getPage(this.args.pageUuid);
        if (!page) return;
        if (isPageSoftDeleted(page)) return;

        await logseq.Editor.deletePage(this.args.pageUuid);
    }
}

export const RestorePageCommandCodec = createReversibleCommandCodec({
    type: "RestorePage",
    serializedSchema: RestorePageCommandSerializedSchema,
    commandSchema: z.instanceof(RestorePageCommand),
    decode: (args) => new RestorePageCommand(args),
    encodeData: (command) => command.args
});
