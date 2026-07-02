import type {BlockUUID} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {normalizePage} from "./utils/normalizePage";
import {isPageSoftDeleted} from "src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";

export const CreatePageCommandArgsSchema = z.object({
    pageName: z.string().describe("Name of the Logseq page to create.")
});

export type CreatePageCommandArgs = z.infer<typeof CreatePageCommandArgsSchema>;

const CreatePageCommandDataSchema = CreatePageCommandArgsSchema.extend({
    type: z.literal("CreatePage")
});

export class CreatePageCommand extends BaseReversibleCommand {
    private pageUUID: BlockUUID | undefined;
    public readonly args: CreatePageCommandArgs;

    public constructor(args: CreatePageCommandArgs) {
        super();
        this.args = CreatePageCommandArgsSchema.parse(args);
    }

    public async execute(deterministicUUIDGenerator: DeterministicUUIDGenerator) {
        const existingPage = await logseq.Editor.getPage(this.args.pageName);
        if (existingPage && !isPageSoftDeleted(existingPage)) {
            throw new Error(`Page already exists: ${this.args.pageName}`);
        }

        if (existingPage) {
            // @ts-ignore restorePage exists in unreleased Logseq APIs but is not in current plugin types.
            await logseq.Editor.restorePage(existingPage.uuid);

            const rawPage = await logseq.Editor.getPage(existingPage.uuid);
            if (!rawPage) throw new Error(`Logseq failed to restore page: ${this.args.pageName}`);

            const page = await normalizePage(rawPage);
            this.pageUUID = page.uuid;
            this.changedPages.push(page.uuid);
            return page;
        }

        const rawPage = await logseq.Editor.createPage(this.args.pageName, undefined, {
            redirect: false,
            customUUID: deterministicUUIDGenerator.getUUID(),
            createFirstBlock: false
        });
        if (!rawPage) throw new Error(`Logseq failed to create page: ${this.args.pageName}`);

        const page = await normalizePage(rawPage);
        this.pageUUID = page.uuid;
        this.changedPages.push(page.uuid);
        return page;
    }

    public async revert(): Promise<void> {
        if (!this.pageUUID) throw new Error("Execute must be called before revert");

        await logseq.Editor.deletePage(this.pageUUID);
    }
}

export const CreatePageCommandCodec = z.codec(
    CreatePageCommandDataSchema,
    z.instanceof(CreatePageCommand),
    {
        decode: ({type: _, ...args}) => new CreatePageCommand(args),
        encode: (command) => ({type: "CreatePage" as const, ...command.args})
    }
);
