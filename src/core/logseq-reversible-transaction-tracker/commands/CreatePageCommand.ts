import type {BlockUUID} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {normalizePage} from "./utils/normalizePage";

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
        if (existingPage) throw new Error(`Page already exists: ${this.args.pageName}`);

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

        // We need to rename page before deleting because otherwise logseq cannot create another new page with same name.
        // If this is not done, will interfere with plugin reversion.
        const newPageName =
            this.args.pageName + "_" + (await logseq.Editor.newBlockUUID()) + "_" + logseq.baseInfo;
        await logseq.Editor.renamePage(this.pageUUID, newPageName);
        await logseq.Editor.deletePage(newPageName);
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
