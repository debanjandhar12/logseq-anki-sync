import type {PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {requireActivePage} from "./utils/validations";

export const RenamePageCommandArgsSchema = z.object({
    pageUuid: LogseqUUIDSchema.describe("UUID of the Logseq page to rename."),
    newName: z.string().describe("New page name.")
});

export type RenamePageCommandArgs = z.infer<typeof RenamePageCommandArgsSchema>;

const RenamePageCommandDataSchema = RenamePageCommandArgsSchema.extend({
    type: z.literal("RenamePage")
});

export class RenamePageCommand extends BaseReversibleCommand {
    private originalName: string | undefined;
    private pageUUID: string | undefined;
    public readonly args: RenamePageCommandArgs;

    public constructor(args: RenamePageCommandArgs) {
        super();
        this.args = RenamePageCommandArgsSchema.parse(args);
    }

    public async execute() {
        const page = await requireActivePage(this.args.pageUuid as PageIdentity);

        this.originalName = page.name;
        this.pageUUID = page.uuid;
        this.changedPages.push(page.uuid);
        await logseq.Editor.renamePage(page.uuid, this.args.newName);
        this.changedPages.push(this.args.newName);
        return true;
    }

    public async revert(): Promise<void> {
        if (!this.originalName || !this.pageUUID)
            throw new Error("Execute must be called before revert");

        await logseq.Editor.renamePage(this.pageUUID, this.originalName);
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
