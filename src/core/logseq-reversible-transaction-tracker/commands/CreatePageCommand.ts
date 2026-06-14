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
    public constructor(public readonly args: CreatePageCommandArgs) {
        super();
    }

    public async execute(deterministicUUIDGenerator: DeterministicUUIDGenerator) {
        const existingPage = await logseq.Editor.getPage(this.args.pageName);
        if (existingPage) throw new Error(`Page already exists: ${this.args.pageName}`);

        const rawPage = await logseq.Editor.createPage(this.args.pageName, undefined, {
            redirect: false,
            customUUID: deterministicUUIDGenerator.getUUID()
        });
        if (!rawPage) throw new Error(`Logseq failed to create page: ${this.args.pageName}`);

        const page = await normalizePage(rawPage);
        this.changedPages.push(page.uuid);
        return page;
    }

    public async revert(): Promise<void> {
        await logseq.Editor.deletePage(this.args.pageName);
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
