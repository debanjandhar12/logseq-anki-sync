import type {BlockIdentity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {isPageSoftDeleted} from "./utils/isPageSoftDeleted";
import {requireActiveBlock} from "./utils/validations";

export const DeleteBlockCommandArgsSchema = z.object({
    blockUuid: LogseqUUIDSchema.describe("UUID of the Logseq block to delete.")
});

export type DeleteBlockCommandArgs = z.infer<typeof DeleteBlockCommandArgsSchema>;

const DeleteBlockCommandDataSchema = DeleteBlockCommandArgsSchema.extend({
    type: z.literal("DeleteBlock")
});

type DeletedBlockLocation = {
    parentUuid: string;
    previousSiblingUuid?: string;
    nextSiblingUuid?: string;
};

export class DeleteBlockCommand extends BaseReversibleCommand {
    private deletedBlockLocation: DeletedBlockLocation | undefined;
    private tempPageUUID: string | undefined;
    public readonly args: DeleteBlockCommandArgs;

    public constructor(args: DeleteBlockCommandArgs) {
        super();
        this.args = DeleteBlockCommandArgsSchema.parse(args);
    }

    public async execute(_deterministicUUIDGenerator: DeterministicUUIDGenerator) {
        const block = await requireActiveBlock(this.args.blockUuid as BlockIdentity);

        const previousSibling = await logseq.Editor.getPreviousSiblingBlock(block.uuid);
        const nextSibling = await logseq.Editor.getNextSiblingBlock(block.uuid);

        this.deletedBlockLocation = {
            parentUuid: block.parent.uuid,
            previousSiblingUuid: previousSibling?.uuid,
            nextSiblingUuid: nextSibling?.uuid
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

        this.changedPages.push(block.page as unknown as PageIdentity);
        await logseq.Editor.deletePage(tempPage.uuid);
        return true;
    }

    public async revert(): Promise<void> {
        if (!this.deletedBlockLocation || !this.tempPageUUID) {
            throw new Error("Execute must be called before revert");
        }

        const {parentUuid, previousSiblingUuid, nextSiblingUuid} = this.deletedBlockLocation;

        // @ts-ignore restorePage exists in unreleased Logseq APIs but is not in current plugin types.
        await logseq.Editor.restorePage(this.tempPageUUID);

        const restoredPage = await logseq.Editor.getPage(this.tempPageUUID);
        if (!restoredPage || isPageSoftDeleted(restoredPage)) {
            throw new Error(`Failed to restore temp page: ${this.tempPageUUID}`);
        }

        // The block retains its UUID through the soft-delete, so move it back to its original spot.
        if (previousSiblingUuid) {
            await logseq.Editor.moveBlock(
                this.args.blockUuid as BlockIdentity,
                previousSiblingUuid as BlockIdentity,
                {children: true}
            );
        } else if (nextSiblingUuid) {
            await logseq.Editor.moveBlock(
                this.args.blockUuid as BlockIdentity,
                nextSiblingUuid as BlockIdentity,
                {before: true, children: true}
            );
        } else {
            await logseq.Editor.moveBlock(
                this.args.blockUuid as BlockIdentity,
                parentUuid as BlockIdentity,
                {children: true}
            );
        }

        await logseq.Editor.deletePage(this.tempPageUUID);
    }
}

export const DeleteBlockCommandCodec = z.codec(
    DeleteBlockCommandDataSchema,
    z.instanceof(DeleteBlockCommand),
    {
        decode: ({type: _, ...args}) => new DeleteBlockCommand(args),
        encode: (command) => ({type: "DeleteBlock" as const, ...command.args})
    }
);
