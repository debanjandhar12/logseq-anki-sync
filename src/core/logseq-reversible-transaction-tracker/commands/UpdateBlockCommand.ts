import type {BlockIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {resolvePageUUID} from "./utils/normalizeBlock";
import {requireActiveBlock} from "./utils/validations";

export const UpdateBlockCommandArgsSchema = z.object({
    blockUuid: LogseqUUIDSchema.describe("UUID of the Logseq block to update."),
    content: z.string().describe("New block content.")
});

export type UpdateBlockCommandArgsInput = z.input<typeof UpdateBlockCommandArgsSchema>;
export type UpdateBlockCommandArgs = z.output<typeof UpdateBlockCommandArgsSchema>;

export const UpdateBlockCommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    originalContent: z.string().optional()
});
export type UpdateBlockCommandState = z.output<typeof UpdateBlockCommandStateSchema>;

/**
 * Updates a Logseq block's content.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - originalContent
 */
export class UpdateBlockCommand extends BaseReversibleCommand<UpdateBlockCommandState> {
    public readonly args: UpdateBlockCommandArgs;

    public constructor(args: UpdateBlockCommandArgsInput, commandState?: UpdateBlockCommandState) {
        super(UpdateBlockCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = UpdateBlockCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        const originalBlock = await requireActiveBlock(this.args.blockUuid as BlockIdentity);

        if (await LogseqEditor.isTagBlock(originalBlock)) {
            throw new Error("Cannot update a tag page using UpdateBlockCommand.");
        }

        if (await LogseqEditor.isPropertyBlock(originalBlock)) {
            throw new Error("Cannot update a property page using UpdateBlockCommand.");
        }

        if (await LogseqEditor.isPageBlock(originalBlock)) {
            throw new Error("Cannot update a page. Block UUID provided must be that of a block.");
        }

        this.commandState.originalContent = originalBlock.content ?? "";
        if (originalBlock.page) this.changedPages.push(await resolvePageUUID(originalBlock.page));
        await LogseqEditor.updateBlock(this.args.blockUuid as BlockIdentity, this.args.content);
        this.commandState.status = "executed";
        return true;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        if (this.commandState.originalContent === undefined)
            throw new Error("Missing original content");

        await LogseqEditor.updateBlock(
            this.args.blockUuid as BlockIdentity,
            this.commandState.originalContent
        );
        this.commandState.status = "new";
    }
}

export const UpdateBlockCommandCodec = createReversibleCommandCodec({
    type: "UpdateBlock",
    argsSchema: UpdateBlockCommandArgsSchema,
    commandStateSchema: UpdateBlockCommandStateSchema,
    commandClass: UpdateBlockCommand
});
