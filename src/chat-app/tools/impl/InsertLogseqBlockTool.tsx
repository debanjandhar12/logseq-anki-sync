import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {InsertBlockCommand} from "src/core/logseq-fakeable-transaction-tracker/commands";
import {z} from "zod";
import {BaseChatTool} from "../base/BaseChatTool";
import {getLastLogseqFakeableTransactionTracker} from "../transaction/getLastLogseqFakeableTransactionTracker";

const insertLogseqBlockParameters = z.object({
    parentUuid: z.string().describe("UUID of the parent Logseq block or page."),
    content: z.string().describe("Content to insert into the new Logseq block.")
});

type InsertLogseqBlockArgs = z.infer<typeof insertLogseqBlockParameters>;

type InsertLogseqBlockResult =
    | {
          success: true;
      }
    | {
          success: false;
          error: string;
      };

export class InsertLogseqBlockTool extends BaseChatTool<
    InsertLogseqBlockArgs,
    InsertLogseqBlockResult
> {
    static readonly NAME = "InsertLogseqBlock";

    readonly name = InsertLogseqBlockTool.NAME;
    readonly description = "Insert a Logseq block under a parent block or page by UUID.";
    readonly parameters = insertLogseqBlockParameters;

    async execute({parentUuid, content}: InsertLogseqBlockArgs): Promise<InsertLogseqBlockResult> {
        try {
            const transactionTracker = getLastLogseqFakeableTransactionTracker();
            transactionTracker.addCommand(new InsertBlockCommand(parentUuid, content));

            await transactionTracker.executeInTheInMemoryDB();

            return {success: true};
        } catch (err) {
            return {
                success: false,
                error: `Failed to insert Logseq block under ${parentUuid}: ${getErrorMessageFromErrObj(err)}`
            };
        }
    }
}
