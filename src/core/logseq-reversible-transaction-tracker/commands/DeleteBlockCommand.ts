import type {BlockIdentity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {isPageSoftDeleted} from "./utils/isPageSoftDeleted";
import {resolvePageUUID} from "./utils/normalizeBlock";
import {requireActiveBlock} from "./utils/validations";

export const DeleteBlockCommandArgsSchema = z.object({
    blockUuid: LogseqUUIDSchema.describe("UUID of the Logseq block to delete.")
});

export type DeleteBlockCommandArgsInput = z.input<typeof DeleteBlockCommandArgsSchema>;
export type DeleteBlockCommandArgs = z.output<typeof DeleteBlockCommandArgsSchema>;

export const DeleteBlockCommandStateSchema = z.object({
    status: z.enum(["new", "executed"]),
    previousBlockUuid: LogseqUUIDSchema.optional(),
    isPreviousBlockParent: z.boolean().optional(),
    temporaryPageUuid: LogseqUUIDSchema.optional()
});
export type DeleteBlockCommandState = z.output<typeof DeleteBlockCommandStateSchema>;

/**
 * Deletes a Logseq block.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - deletedBlockLocation
 * - tempPageUUID
 */
export class DeleteBlockCommand extends BaseReversibleCommand<DeleteBlockCommandState> {
    public readonly args: DeleteBlockCommandArgs;

    public constructor(args: DeleteBlockCommandArgsInput, commandState?: DeleteBlockCommandState) {
        super(DeleteBlockCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = DeleteBlockCommandArgsSchema.parse(args);
    }

    public async execute() {
        this.assertCanExecute();
        const block = await requireActiveBlock(this.args.blockUuid as BlockIdentity);
        const isPageBlock = await LogseqEditor.isPageBlock(block);
        if (isPageBlock === true) {
            throw new Error("Cannot delete a page. Block UUID provided must be that of a block.");
        }

        const previousBlock = await LogseqEditor.getPreviousBlock(block.uuid, {parent: true});
        const isPreviousBlockParent = await LogseqEditor.getWhetherPreviousBlockIsParent(
            block.uuid
        );
        if (!previousBlock) throw new Error("Deleted block has no previous block or parent");

        this.commandState.previousBlockUuid = previousBlock.uuid;
        this.commandState.isPreviousBlockParent = isPreviousBlockParent;

        const tempPageName = `deleted_block_${block.uuid}_${Date.now()}`;
        const tempPage = await logseq.Editor.createPage(tempPageName, undefined, {
            redirect: false,
            createFirstBlock: false
        });
        if (!tempPage) throw new Error(`Logseq failed to create temp page: ${tempPageName}`);

        this.commandState.temporaryPageUuid = tempPage.uuid;

        await logseq.Editor.moveBlock(block.uuid, tempPage.uuid as BlockIdentity, {
            children: true
        });

        this.changedPages.push(await resolvePageUUID(block.page));
        await logseq.Editor.deletePage(tempPage.uuid);
        this.commandState.status = "executed";
        return true;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        const {previousBlockUuid, isPreviousBlockParent, temporaryPageUuid} = this.commandState;
        if (!previousBlockUuid || isPreviousBlockParent === undefined || !temporaryPageUuid) {
            throw new Error("Missing deleted block rollback state");
        }

        // @ts-ignore restorePage exists in unreleased Logseq APIs but is not in current plugin types.
        await logseq.Editor.restorePage(temporaryPageUuid);

        const restoredPage = await logseq.Editor.getPage(temporaryPageUuid);
        if (!restoredPage || isPageSoftDeleted(restoredPage)) {
            throw new Error(`Failed to restore temp page: ${temporaryPageUuid}`);
        }

        // The block retains its UUID through the soft-delete, so move it back to its original spot.
        if (!isPreviousBlockParent) {
            await logseq.Editor.moveBlock(
                this.args.blockUuid as BlockIdentity,
                previousBlockUuid as BlockIdentity,
                {}
            );
        } else {
            const nextBlock = await LogseqEditor.getNextBlock(previousBlockUuid as BlockIdentity, {
                children: true
            });

            if (!nextBlock) {
                await logseq.Editor.moveBlock(
                    this.args.blockUuid as BlockIdentity,
                    previousBlockUuid as BlockIdentity,
                    {children: true}
                );
                await logseq.Editor.deletePage(temporaryPageUuid);
                this.commandState.status = "new";
                return;
            }

            await logseq.Editor.moveBlock(
                this.args.blockUuid as BlockIdentity,
                nextBlock.uuid as BlockIdentity,
                {before: true}
            );
        }

        await logseq.Editor.deletePage(temporaryPageUuid);
        this.commandState.status = "new";
    }
}

export const DeleteBlockCommandCodec = createReversibleCommandCodec({
    type: "DeleteBlock",
    argsSchema: DeleteBlockCommandArgsSchema,
    commandStateSchema: DeleteBlockCommandStateSchema,
    commandClass: DeleteBlockCommand
});
