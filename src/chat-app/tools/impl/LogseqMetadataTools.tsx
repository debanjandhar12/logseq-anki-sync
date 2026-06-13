import {ToolResponse} from "assistant-stream";
import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {createLogseqFakeableTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqFakeableTransactionTrackerArtifact";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import type {LogseqFakeableCommand} from "src/core/logseq-fakeable-transaction-tracker";
import {
    AddBlockTagCommand,
    AddTagExtendsCommand,
    AddTagPropertyCommand,
    CreateTagCommand,
    RemoveBlockPropertyCommand,
    RemoveBlockTagCommand,
    RemovePropertyCommand,
    RemoveTagExtendsCommand,
    RemoveTagPropertyCommand,
    UpsertBlockPropertyCommand,
    UpsertPropertyCommand
} from "src/core/logseq-fakeable-transaction-tracker/commands";
import {z} from "zod";

type MetadataToolResult =
    | {success: true}
    | {
          success: false;
          error: string;
      };

abstract class LogseqMetadataTool<TArgs extends Record<string, unknown>> extends BaseChatToolWithDefaultUI<
    TArgs,
    MetadataToolResult
> {
    protected abstract readonly actionDescription: string;
    protected abstract createCommand(args: TArgs): LogseqFakeableCommand;

    async execute(
        args: TArgs,
        context?: ChatToolExecutionContext
    ): Promise<MetadataToolResult | ToolResponse<MetadataToolResult>> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            transactionTracker.addCommand(this.createCommand(args));
            await transactionTracker.executeInTheInMemoryDB();
            return new ToolResponse({
                result: {success: true},
                artifact: createLogseqFakeableTransactionTrackerArtifact(transactionTracker)
            });
        } catch (error) {
            return {
                success: false,
                error: `Failed to ${this.actionDescription}: ${getErrorMessageFromErrObj(error)}`
            };
        }
    }
}

const propertySchema = z.record(z.string(), z.any());
const tagPropertySchema = z.object({
    name: z.string(),
    schema: propertySchema.optional(),
    properties: z.record(z.string(), z.any()).optional()
});

const upsertPropertyArgs = z.object({
    key: z.string().describe("Stable property key."),
    schema: propertySchema.optional().describe("Partial Logseq property schema."),
    name: z.string().optional().describe("Optional display name.")
});
type UpsertPropertyArgs = z.infer<typeof upsertPropertyArgs>;

export class LogseqUpsertPropertyTool extends LogseqMetadataTool<UpsertPropertyArgs> {
    static readonly NAME = "logseq_upsert_property";
    readonly name = LogseqUpsertPropertyTool.NAME;
    readonly description = "Create or update a Logseq property schema.";
    readonly parameters = upsertPropertyArgs;
    protected readonly actionDescription = "upsert Logseq property";

    protected createCommand({key, schema, name}: UpsertPropertyArgs): LogseqFakeableCommand {
        return new UpsertPropertyCommand(key, schema, name === undefined ? undefined : {name});
    }
}

const removePropertyArgs = z.object({key: z.string().describe("Property key to remove.")});
type RemovePropertyArgs = z.infer<typeof removePropertyArgs>;

export class LogseqRemovePropertyTool extends LogseqMetadataTool<RemovePropertyArgs> {
    static readonly NAME = "logseq_remove_property";
    readonly name = LogseqRemovePropertyTool.NAME;
    readonly description = "Remove a Logseq property schema and its stored values.";
    readonly parameters = removePropertyArgs;
    protected readonly actionDescription = "remove Logseq property";

    protected createCommand({key}: RemovePropertyArgs): LogseqFakeableCommand {
        return new RemovePropertyCommand(key);
    }
}

const upsertBlockPropertyArgs = z.object({
    blockId: z.string().describe("UUID or name of the target block or page."),
    key: z.string().describe("Property key."),
    value: z.any().describe("Property value."),
    reset: z.boolean().optional().describe("Replace a many-cardinality value instead of appending.")
});
type UpsertBlockPropertyArgs = z.infer<typeof upsertBlockPropertyArgs>;

export class LogseqUpsertBlockPropertyTool extends LogseqMetadataTool<UpsertBlockPropertyArgs> {
    static readonly NAME = "logseq_upsert_block_property";
    readonly name = LogseqUpsertBlockPropertyTool.NAME;
    readonly description = "Set a property value on a Logseq block or page.";
    readonly parameters = upsertBlockPropertyArgs;
    protected readonly actionDescription = "upsert Logseq block property";

    protected createCommand({
        blockId,
        key,
        value,
        reset
    }: UpsertBlockPropertyArgs): LogseqFakeableCommand {
        return new UpsertBlockPropertyCommand(
            blockId,
            key,
            value,
            reset === undefined ? undefined : {reset}
        );
    }
}

const removeBlockPropertyArgs = z.object({
    blockId: z.string().describe("UUID or name of the target block or page."),
    key: z.string().describe("Property key to remove.")
});
type RemoveBlockPropertyArgs = z.infer<typeof removeBlockPropertyArgs>;

export class LogseqRemoveBlockPropertyTool extends LogseqMetadataTool<RemoveBlockPropertyArgs> {
    static readonly NAME = "logseq_remove_block_property";
    readonly name = LogseqRemoveBlockPropertyTool.NAME;
    readonly description = "Remove a property value from a Logseq block or page.";
    readonly parameters = removeBlockPropertyArgs;
    protected readonly actionDescription = "remove Logseq block property";

    protected createCommand({blockId, key}: RemoveBlockPropertyArgs): LogseqFakeableCommand {
        return new RemoveBlockPropertyCommand(blockId, key);
    }
}

const createTagArgs = z.object({
    tagName: z.string().describe("Tag/class name."),
    uuid: z.string().optional().describe("Optional deterministic tag UUID."),
    tagProperties: z
        .array(tagPropertySchema)
        .optional()
        .describe("Property schemas that belong to the tag.")
});
type CreateTagArgs = z.infer<typeof createTagArgs>;

export class LogseqCreateTagTool extends LogseqMetadataTool<CreateTagArgs> {
    static readonly NAME = "logseq_create_tag";
    readonly name = LogseqCreateTagTool.NAME;
    readonly description = "Create or update a Logseq tag/class and its property schemas.";
    readonly parameters = createTagArgs;
    protected readonly actionDescription = "create Logseq tag";

    protected createCommand({tagName, uuid, tagProperties}: CreateTagArgs): LogseqFakeableCommand {
        return new CreateTagCommand(tagName, {uuid, tagProperties});
    }
}

const tagPropertyArgs = z.object({
    tagId: z.string().describe("Tag name or UUID."),
    propertyIdOrName: z.string().describe("Property key or UUID.")
});
type TagPropertyArgs = z.infer<typeof tagPropertyArgs>;

export class LogseqAddTagPropertyTool extends LogseqMetadataTool<TagPropertyArgs> {
    static readonly NAME = "logseq_add_tag_property";
    readonly name = LogseqAddTagPropertyTool.NAME;
    readonly description = "Add a property schema to a Logseq tag/class.";
    readonly parameters = tagPropertyArgs;
    protected readonly actionDescription = "add Logseq tag property";

    protected createCommand(args: TagPropertyArgs): LogseqFakeableCommand {
        return new AddTagPropertyCommand(args.tagId, args.propertyIdOrName);
    }
}

export class LogseqRemoveTagPropertyTool extends LogseqMetadataTool<TagPropertyArgs> {
    static readonly NAME = "logseq_remove_tag_property";
    readonly name = LogseqRemoveTagPropertyTool.NAME;
    readonly description = "Remove a property schema from a Logseq tag/class.";
    readonly parameters = tagPropertyArgs;
    protected readonly actionDescription = "remove Logseq tag property";

    protected createCommand(args: TagPropertyArgs): LogseqFakeableCommand {
        return new RemoveTagPropertyCommand(args.tagId, args.propertyIdOrName);
    }
}

const tagExtendsArgs = z.object({
    tagId: z.string().describe("Child tag name or UUID."),
    parentTagIdOrName: z.string().describe("Parent tag name or UUID.")
});
type TagExtendsArgs = z.infer<typeof tagExtendsArgs>;

export class LogseqAddTagExtendsTool extends LogseqMetadataTool<TagExtendsArgs> {
    static readonly NAME = "logseq_add_tag_extends";
    readonly name = LogseqAddTagExtendsTool.NAME;
    readonly description = "Make one Logseq tag/class inherit another.";
    readonly parameters = tagExtendsArgs;
    protected readonly actionDescription = "add Logseq tag inheritance";

    protected createCommand(args: TagExtendsArgs): LogseqFakeableCommand {
        return new AddTagExtendsCommand(args.tagId, args.parentTagIdOrName);
    }
}

export class LogseqRemoveTagExtendsTool extends LogseqMetadataTool<TagExtendsArgs> {
    static readonly NAME = "logseq_remove_tag_extends";
    readonly name = LogseqRemoveTagExtendsTool.NAME;
    readonly description = "Remove inheritance between two Logseq tags/classes.";
    readonly parameters = tagExtendsArgs;
    protected readonly actionDescription = "remove Logseq tag inheritance";

    protected createCommand(args: TagExtendsArgs): LogseqFakeableCommand {
        return new RemoveTagExtendsCommand(args.tagId, args.parentTagIdOrName);
    }
}

const blockTagArgs = z.object({
    blockId: z.string().describe("UUID or name of the target block or page."),
    tagId: z.string().describe("Tag name or UUID.")
});
type BlockTagArgs = z.infer<typeof blockTagArgs>;

export class LogseqAddBlockTagTool extends LogseqMetadataTool<BlockTagArgs> {
    static readonly NAME = "logseq_add_block_tag";
    readonly name = LogseqAddBlockTagTool.NAME;
    readonly description =
        "Add a tag/class to a Logseq block or page, importing the tag's property schema.";
    readonly parameters = blockTagArgs;
    protected readonly actionDescription = "add Logseq block tag";

    protected createCommand(args: BlockTagArgs): LogseqFakeableCommand {
        return new AddBlockTagCommand(args.blockId, args.tagId);
    }
}

export class LogseqRemoveBlockTagTool extends LogseqMetadataTool<BlockTagArgs> {
    static readonly NAME = "logseq_remove_block_tag";
    readonly name = LogseqRemoveBlockTagTool.NAME;
    readonly description = "Remove a tag/class from a Logseq block or page.";
    readonly parameters = blockTagArgs;
    protected readonly actionDescription = "remove Logseq block tag";

    protected createCommand(args: BlockTagArgs): LogseqFakeableCommand {
        return new RemoveBlockTagCommand(args.blockId, args.tagId);
    }
}
