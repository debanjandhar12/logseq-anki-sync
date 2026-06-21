import type {BlockIdentity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {LogseqUUIDSchema} from "./LogseqUUIDSchema";
import {BlockTreeDeletionSnapshot, type DeletedBlockTreeSnapshot} from "./utils/BlockTreeDeletionSnapshot";

export const DeleteBlockCommandArgsSchema = z.object({
    blockUuid: LogseqUUIDSchema.describe("UUID of the Logseq block to delete.")
});

export type DeleteBlockCommandArgs = z.infer<typeof DeleteBlockCommandArgsSchema>;

const DeleteBlockCommandDataSchema = DeleteBlockCommandArgsSchema.extend({
    type: z.literal("DeleteBlock")
});

export class DeleteBlockCommand extends BaseReversibleCommand {
    private deletedBlockTreeSnapshot: DeletedBlockTreeSnapshot | undefined;
    public readonly args: DeleteBlockCommandArgs;

    public constructor(args: DeleteBlockCommandArgs) {
        super();
        this.args = DeleteBlockCommandArgsSchema.parse(args);
    }

    public async execute(_deterministicUUIDGenerator: DeterministicUUIDGenerator) {
        const snapshot = await BlockTreeDeletionSnapshot.capture(
            this.args.blockUuid as BlockIdentity
        );
        this.deletedBlockTreeSnapshot = snapshot;
        this.changedPages.push(snapshot.block.page as unknown as PageIdentity);

        await logseq.Editor.removeBlock(snapshot.uuid);
        return true;
    }

    public async revert(): Promise<void> {
        if (!this.deletedBlockTreeSnapshot) throw new Error("Execute must be called before revert");

        const snapshot = this.deletedBlockTreeSnapshot;
        await BlockTreeDeletionSnapshot.restore(snapshot, {
            parentUuid: snapshot.block.parent.uuid,
            previousSiblingUuid: snapshot.previousSiblingUuid,
            nextSiblingUuid: snapshot.nextSiblingUuid
        });
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
