import type {EntityID, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {LogseqIdentitySchema} from "./schemas";

export const RenamePageCommandArgsSchema = z.object({
    pageUuid: LogseqIdentitySchema.describe("Page identity to rename."),
    newName: z.string().describe("New page name.")
});

export type RenamePageCommandArgs = z.infer<typeof RenamePageCommandArgsSchema>;

const RenamePageCommandDataSchema = RenamePageCommandArgsSchema.extend({
    type: z.literal("RenamePage")
});

export class RenamePageCommand extends BaseReversibleCommand {
    private originalName: string | undefined;

    public constructor(public readonly args: RenamePageCommandArgs) {
        super();
    }

    public async execute(_deterministicUUIDGenerator: DeterministicUUIDGenerator) {
        const page = await logseq.Editor.getPage(this.args.pageUuid as PageIdentity | EntityID);
        if (!page?.name) throw new Error(`Page not found: ${JSON.stringify(this.args.pageUuid)}`);

        this.originalName = page.name;
        this.changedPages.push(page.uuid);
        await logseq.Editor.renamePage(page.name, this.args.newName);
        this.changedPages.push(this.args.newName);
        return true;
    }

    public async revert(): Promise<void> {
        if (!this.originalName) throw new Error("Execute must be called before revert");

        await logseq.Editor.renamePage(this.args.newName, this.originalName);
    }
}

export const RenamePageCommandCodec = z.codec(
    RenamePageCommandDataSchema,
    z.instanceof(RenamePageCommand),
    {
        decode: ({type: _, ...args}) => new RenamePageCommand(args),
        encode: (command) => ({type: "RenamePage" as const, ...command.args})
    }
);
