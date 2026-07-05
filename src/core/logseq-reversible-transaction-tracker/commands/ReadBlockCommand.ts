import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {normalizeBlock} from "./utils/normalizeBlock";
import {normalizePage} from "./utils/normalizePage";
import {normalizeTagPage} from "./utils/normalizeTagPage";

export const ReadBlockCommandArgsSchema = z.object({
    uuid: z
        .string()
        .describe("UUID of the Logseq block, page, tag page, or property page to read."),
    includeChildren: z.boolean().optional().describe("Whether to include child blocks")
});

export type ReadBlockCommandArgsInput = z.input<typeof ReadBlockCommandArgsSchema>;
export type ReadBlockCommandArgs = z.output<typeof ReadBlockCommandArgsSchema>;

export type ReadBlockCommandResult =
    | {
          type: "tag";
          block: PageEntity | null;
      }
    | {
          type: "property";
          block: Awaited<ReturnType<typeof LogseqEditor.getProperty>>;
      }
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
 * Reads a Logseq block, page, tag page, or property page by UUID.
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
        if (await LogseqEditor.isTagBlock(this.args.uuid)) {
            const tag = await logseq.Editor.getTag(this.args.uuid);
            return {type: "tag", block: tag ? await normalizeTagPage(tag) : null};
        }

        if (await LogseqEditor.isPropertyBlock(this.args.uuid)) {
            return {type: "property", block: await LogseqEditor.getProperty(this.args.uuid)};
        }

        const block = await LogseqPropertiesHelper.getBlock(this.args.uuid, {
            includeChildren: this.args.includeChildren ?? false
        });

        const page =
            block && typeof block.content === "string"
                ? null
                : await LogseqPropertiesHelper.getPage(this.args.uuid);

        if (page) {
            if (this.args.includeChildren) {
                const children = await LogseqPropertiesHelper.getPageBlocksTree(this.args.uuid);
                const normalizedPage = await normalizePage({
                    ...page,
                    children
                } as unknown as PageEntity);
                return {
                    type: "page",
                    block: normalizedPage as unknown as Omit<PageEntity, "children"> & {
                        children?: BlockEntity[];
                    }
                };
            }

            const normalizedPage = await normalizePage(page);
            const {children: _pageChildren, ...pageWithoutChildren} = normalizedPage;
            return {type: "page", block: pageWithoutChildren};
        }

        return {type: "block", block: block ? await normalizeBlock(block) : null};
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
