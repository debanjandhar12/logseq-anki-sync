import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "src/logseq/LogseqEditor";
import {LogseqPropertiesHelper} from "src/logseq/LogseqPropertiesHelper";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";
import {normalizeBlock} from "./utils/normalizeBlock";
import {normalizePage} from "./utils/normalizePage";
import {normalizePropertyPage} from "./utils/normalizePropertyPage";
import {normalizeTagPage} from "./utils/normalizeTagPage";

const ReadBlockCommandArgsBaseSchema = z.object({
    uuid: z.string().optional().describe("UUID of the Logseq block, page, or tag page to read."),
    propertyIndent: z
        .string()
        .optional()
        .describe("Property ident/key to read with logseq.Editor.getProperty."),
    includeChildren: z.boolean().optional().describe("Whether to include child blocks")
});

export const ReadBlockCommandArgsSchema = ReadBlockCommandArgsBaseSchema.refine(
    (args) => Boolean(args.uuid) !== Boolean(args.propertyIndent),
    "Pass exactly one of uuid or propertyIndent."
);

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

export const ReadBlockCommandStateSchema = z.object({
    status: z.enum(["new", "executed"])
});
export type ReadBlockCommandState = z.output<typeof ReadBlockCommandStateSchema>;

/**
 * Reads a Logseq block/page/tag by UUID, or a property by property ident/key.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - none
 */
export class ReadBlockCommand extends BaseReversibleCommand<ReadBlockCommandState> {
    public readonly args: ReadBlockCommandArgs;

    public constructor(args: ReadBlockCommandArgsInput, commandState?: ReadBlockCommandState) {
        super(ReadBlockCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = ReadBlockCommandArgsSchema.parse(args);
    }

    public async execute(): Promise<ReadBlockCommandResult> {
        this.assertCanExecute();
        const result = await this.read();
        this.commandState.status = "executed";
        return result;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        this.commandState.status = "new";
    }

    public override isGraphMutation(): boolean {
        return false;
    }

    private async read(): Promise<ReadBlockCommandResult> {
        if (this.args.propertyIndent) {
            const property = await LogseqEditor.getProperty(this.args.propertyIndent);
            return {
                type: "property",
                block: property ? normalizePropertyPage(property) : null
            };
        }

        const uuid = this.args.uuid;
        if (!uuid) throw new Error("ReadBlockCommand requires uuid or propertyIndent.");

        if (await LogseqEditor.isTagBlock(uuid)) {
            const tag = await logseq.Editor.getTag(uuid);
            return {type: "tag", block: tag ? await normalizeTagPage(tag) : null};
        }

        const propertyBlock = await logseq.Editor.getBlock(uuid);
        if (propertyBlock && (await LogseqEditor.isPropertyBlock(propertyBlock))) {
            const property = await LogseqEditor.getProperty(uuid);
            return {
                type: "property",
                block: property ? normalizePropertyPage(property) : null
            };
        }

        const block = await LogseqPropertiesHelper.getBlock(uuid, {
            includeChildren: this.args.includeChildren ?? false
        });

        const page =
            block && typeof block.content === "string"
                ? null
                : await LogseqPropertiesHelper.getPage(uuid);

        if (page) {
            if (this.args.includeChildren) {
                const children = await LogseqPropertiesHelper.getPageBlocksTree(uuid);
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
}

export const ReadBlockCommandCodec = createReversibleCommandCodec({
    type: "ReadBlock",
    argsSchema: ReadBlockCommandArgsSchema,
    commandStateSchema: ReadBlockCommandStateSchema,
    commandClass: ReadBlockCommand
});
