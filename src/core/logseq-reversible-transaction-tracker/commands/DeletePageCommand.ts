import type {EntityID, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {z} from "zod";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {LogseqIdentitySchema} from "./schemas";

export const DeletePageCommandArgsSchema = z.object({
    pageUuid: LogseqIdentitySchema.describe("Page identity to delete.")
});

export type DeletePageCommandArgs = z.infer<typeof DeletePageCommandArgsSchema>;

const DeletePageCommandDataSchema = DeletePageCommandArgsSchema.extend({
    type: z.literal("DeletePage")
});

export class DeletePageCommand extends BaseReversibleCommand {
    private executed = false;

    public constructor(public readonly args: DeletePageCommandArgs) {
        super();
    }

    public async execute(_deterministicUUIDGenerator: DeterministicUUIDGenerator) {
        const page = await logseq.Editor.getPage(this.args.pageUuid as PageIdentity | EntityID);
        if (!page?.name) throw new Error(`Page not found: ${JSON.stringify(this.args.pageUuid)}`);

        this.changedPages.push(page.uuid);
        await logseq.Editor.deletePage(page.name);
        this.executed = true;
        return true;
    }

    public async revert(): Promise<void> {
        if (!this.executed) throw new Error("Execute must be called before revert");

        throw new Error(
            "DeletePageCommand revert requires snapshot restore support and is not implemented yet"
        );
    }
}

export const DeletePageCommandCodec = z.codec(
    DeletePageCommandDataSchema,
    z.instanceof(DeletePageCommand),
    {
        decode: ({type: _, ...args}) => new DeletePageCommand(args),
        encode: (command) => ({type: "DeletePage" as const, ...command.args})
    }
);
