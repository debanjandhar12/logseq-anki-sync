import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";

export const ReadBlockCommandArgsSchema = z.object({
    uuid: z.string().describe("UUID of the Logseq block or page to read."),
    includeChildren: z.boolean().optional().describe("Whether to include child blocks")
});

export type ReadBlockCommandArgsInput = z.input<typeof ReadBlockCommandArgsSchema>;
export type ReadBlockCommandArgs = z.output<typeof ReadBlockCommandArgsSchema>;

export type ReadBlockCommandResult =
    | {
          type: "block";
          block: BlockEntity | null;
      }
    | {
          type: "page";
          block: Omit<PageEntity, "children"> & {children?: BlockEntity[]};
      };

const ReadBlockCommandSerializedSchema = ReadBlockCommandArgsSchema.extend({
    type: z.literal("ReadBlock")
});

/**
 * Reads a Logseq block or page by UUID.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - none
 */
export class ReadBlockCommand extends BaseReversibleCommand {
    public readonly args: ReadBlockCommandArgs;

    public constructor(args: ReadBlockCommandArgsInput) {
        super();
        this.args = ReadBlockCommandArgsSchema.parse(args);
    }

    public async execute(): Promise<ReadBlockCommandResult> {
        const block = await LogseqPropertiesHelper.getBlock(this.args.uuid, {
            includeChildren: this.args.includeChildren ?? false
        });

        const page =
            block && typeof block.content === "string"
                ? null
                : await LogseqPropertiesHelper.getPage(this.args.uuid);

        if (!page) return {type: "block", block};

        const {children: _pageChildren, ...pageWithoutChildren} = page;

        if (this.args.includeChildren) {
            const children = await LogseqPropertiesHelper.getPageBlocksTree(this.args.uuid);
            return {type: "page", block: {...pageWithoutChildren, children}};
        }

        return {type: "page", block: pageWithoutChildren};
    }

    public async revert(): Promise<void> {}
}

export const ReadBlockCommandCodec = createReversibleCommandCodec({
    type: "ReadBlock",
    serializedSchema: ReadBlockCommandSerializedSchema,
    commandSchema: z.instanceof(ReadBlockCommand),
    decode: (args) => new ReadBlockCommand(args),
    encodeData: (command) => command.args
});
