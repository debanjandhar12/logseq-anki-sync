import type {ChatToolExecutionContext} from "src/chat-app/tools/base/BaseChatTool";
import {BaseChatToolWithDefaultUI} from "src/chat-app/tools/base/BaseChatToolWithDefaultUI";
import {
    type ChatToolErrorResult,
    ChatToolResponse,
    type ChatToolSuccessResult
} from "src/chat-app/tools/base/ChatToolResponse";
import {addAndExecLogseqReversibleCommand} from "src/chat-app/tools/transaction/addAndExecLogseqReversibleCommand";
import {createLogseqReversibleTransactionTrackerArtifact} from "src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {getTrackerArtifactFromError} from "src/chat-app/tools/transaction/getTrackerArtifactFromError";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {
    type LogseqReversibleTransactionResult,
    UpsertPropertyPageCommand,
    type UpsertPropertyPageCommandArgs,
    UpsertPropertyPageCommandArgsSchema
} from "src/core/logseq-reversible-transaction-tracker";

type LogseqUpsertPropertyPageResult =
    | ChatToolSuccessResult<{property: LogseqReversibleTransactionResult}>
    | ChatToolErrorResult;

export class LogseqUpsertPropertyPageTool extends BaseChatToolWithDefaultUI<
    UpsertPropertyPageCommandArgs,
    LogseqUpsertPropertyPageResult
> {
    static readonly NAME = "logseq_upsert_property_page";

    readonly name = LogseqUpsertPropertyPageTool.NAME;
    readonly description =
        "Create or update a Logseq property page/schema by property page UUID or property indent/key.";
    readonly parameters = UpsertPropertyPageCommandArgsSchema;

    async execute(
        args: UpsertPropertyPageCommandArgs,
        context?: ChatToolExecutionContext
    ): Promise<ChatToolResponse<LogseqUpsertPropertyPageResult>> {
        try {
            const {result: property, tracker} = await addAndExecLogseqReversibleCommand({
                command: new UpsertPropertyPageCommand(args),
                messages: context?.messages,
                signal: context?.abortSignal
            });

            return ChatToolResponse.success(
                {property},
                createLogseqReversibleTransactionTrackerArtifact(tracker)
            );
        } catch (err) {
            return ChatToolResponse.error(
                `Failed to upsert Logseq property page ${args.propertyUuidOrIndent}: ${getErrorMessageFromErrObj(err)}`,
                getTrackerArtifactFromError(err)
            );
        }
    }
}
