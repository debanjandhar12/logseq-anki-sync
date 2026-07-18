import type {PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {requireActivePage} from "./utils/validations";

export const RenamePageCommandArgsSchema = z.object({
    pageUuid: LogseqUUIDSchema.describe("UUID of the Logseq page to rename."),
    newName: z.string().describe("New page name.")
});

export type RenamePageCommandArgsInput = z.input<typeof RenamePageCommandArgsSchema>;
export type RenamePageCommandArgs = z.output<typeof RenamePageCommandArgsSchema>;

export const RenamePageCommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    originalName: z.string().optional()
});
export type RenamePageCommandState = z.output<typeof RenamePageCommandStateSchema>;

/**
 * Renames a Logseq page.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - originalName
 * - pageUUID
 */
export class RenamePageCommand extends BaseReversibleCommand<RenamePageCommandState> {
    public readonly args: RenamePageCommandArgs;

    public constructor(args: RenamePageCommandArgsInput, commandState?: RenamePageCommandState) {
        super(RenamePageCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = RenamePageCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        const page = await requireActivePage(this.args.pageUuid as PageIdentity);

        this.commandState.originalName = page.name;
        this.changedPages.push(page.uuid);
        await logseq.Editor.renamePage(page.uuid, this.args.newName);
        this.changedPages.push(this.args.newName);
        this.commandState.status = "executed";
        return true;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        if (!this.commandState.originalName) throw new Error("Missing original page name");

        await logseq.Editor.renamePage(this.args.pageUuid, this.commandState.originalName);
        this.commandState.status = "new";
    }
}

export const RenamePageCommandCodec = createReversibleCommandCodec({
    type: "RenamePage",
    argsSchema: RenamePageCommandArgsSchema,
    commandStateSchema: RenamePageCommandStateSchema,
    commandClass: RenamePageCommand
});
