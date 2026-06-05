import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {getLastLogseqFakeableTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqFakeableTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import type {
    InMemoryBlockEntity,
    InMemoryLogseqEntity,
    InMemoryPageEntity
} from "src/core/logseq-fakeable-transaction-tracker";
import {z} from "zod";

const readLogseqBlockParameters = z.object({
    uuid: z.string().describe("UUID of the Logseq block or page to read."),
    includeChildren: z.boolean().optional().describe("Whether to include child blocks")
});

type ReadLogseqBlockArgs = z.infer<typeof readLogseqBlockParameters>;

type ReadLogseqBlockResult =
    | {
          success: true;
          type: "block" | "page";
          block: InMemoryBlockEntity | InMemoryPageEntity;
      }
    | {
          success: false;
          error: string;
      };

export class ReadLogseqBlockTool extends BaseChatToolWithDefaultUI<
    ReadLogseqBlockArgs,
    ReadLogseqBlockResult
> {
    static readonly NAME = "ReadLogseqBlock";

    readonly name = ReadLogseqBlockTool.NAME;
    readonly description = "Read a Logseq block or page by UUID.";
    readonly parameters = readLogseqBlockParameters;

    async execute(
        {uuid, includeChildren = false}: ReadLogseqBlockArgs,
        context?: ChatToolExecutionContext
    ): Promise<ReadLogseqBlockResult> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker(context?.messages);
            const executor = await transactionTracker.executeInTheInMemoryDB();
            const block = await executor.readBlockOrPage(uuid, includeChildren);
            if (!block) {
                return {success: false, error: `Logseq block not found: ${uuid}`};
            }

            const result = executor.getLastResult() as InMemoryLogseqEntity;
            return {success: true, type: isPageEntity(result) ? "page" : "block", block: result};
        } catch (err) {
            return {
                success: false,
                error: `Failed to read Logseq block ${uuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}

function isPageEntity(entity: InMemoryLogseqEntity): entity is InMemoryPageEntity {
    return "name" in entity && "type" in entity;
}
