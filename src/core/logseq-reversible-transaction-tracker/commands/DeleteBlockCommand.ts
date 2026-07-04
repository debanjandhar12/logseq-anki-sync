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

const DeleteBlockCommandSerializedSchema = DeleteBlockCommandArgsSchema.extend({
    type: z.literal("DeleteBlock")
});

export type DeleteBlockCommandSerializedState = Omit<
    z.output<typeof DeleteBlockCommandSerializedSchema>,
    "type" | keyof DeleteBlockCommandArgs
>;

type DeletedBlockLocation = {
    previousBlockUuid: string;
    isPreviousBlockParent: boolean;
};

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
export class DeleteBlockCommand extends BaseReversibleCommand {
    private deletedBlockLocation: DeletedBlockLocation | undefined;
    private tempPageUUID: string | undefined;
    public readonly args: DeleteBlockCommandArgs;

    public constructor(args: DeleteBlockCommandArgsInput) {
        super();
        this.args = DeleteBlockCommandArgsSchema.parse(args);
    }

    public async execute() {
        const block = await requireActiveBlock(this.args.blockUuid as BlockIdentity);
        const isPageBlock = logseq.Editor.isPageBlock(block);
        if (isPageBlock === true) {
            throw new Error("Cannot delete a page. Block UUID provided must be that of a block.");
        }

        const previousBlock = await LogseqEditor.getPreviousBlock(block.uuid, {parent: true});
        const isPreviousBlockParent = await LogseqEditor.getWhetherPreviousBlockIsParent(
            block.uuid
        );
        if (!previousBlock) throw new Error("Deleted block has no previous block or parent");

        this.deletedBlockLocation = {
            previousBlockUuid: previousBlock.uuid,
            isPreviousBlockParent
        };

        const tempPageName = `deleted_block_${block.uuid}_${Date.now()}`;
        const tempPage = await logseq.Editor.createPage(tempPageName, undefined, {
            redirect: false,
            createFirstBlock: false
        });
        if (!tempPage) throw new Error(`Logseq failed to create temp page: ${tempPageName}`);

        this.tempPageUUID = tempPage.uuid;

        await logseq.Editor.moveBlock(block.uuid, tempPage.uuid as BlockIdentity, {
            children: true
        });

        this.changedPages.push(await resolvePageUUID(block.page));
        await logseq.Editor.deletePage(tempPage.uuid);
        return true;
    }

    public async revert(): Promise<void> {
        if (!this.deletedBlockLocation || !this.tempPageUUID) {
            throw new Error("Execute must be called before revert");
        }

        const {previousBlockUuid, isPreviousBlockParent} = this.deletedBlockLocation;

        // @ts-ignore restorePage exists in unreleased Logseq APIs but is not in current plugin types.
        await logseq.Editor.restorePage(this.tempPageUUID);

        const restoredPage = await logseq.Editor.getPage(this.tempPageUUID);
        if (!restoredPage || isPageSoftDeleted(restoredPage)) {
            throw new Error(`Failed to restore temp page: ${this.tempPageUUID}`);
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
                await logseq.Editor.deletePage(this.tempPageUUID);
                return;
            }

            await logseq.Editor.moveBlock(
                this.args.blockUuid as BlockIdentity,
                nextBlock.uuid as BlockIdentity,
                {before: true}
            );
        }

        await logseq.Editor.deletePage(this.tempPageUUID);
    }
}

export const DeleteBlockCommandCodec = createReversibleCommandCodec({
    type: "DeleteBlock",
    serializedSchema: DeleteBlockCommandSerializedSchema,
    commandSchema: z.instanceof(DeleteBlockCommand),
    decode: (args) => new DeleteBlockCommand(args),
    encodeData: (command) => command.args
});
