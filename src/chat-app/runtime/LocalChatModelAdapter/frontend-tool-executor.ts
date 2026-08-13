import type {ThreadMessage} from "@assistant-ui/react";
import {ChatToolResponse} from "src/chat-app/tools/base/ChatToolResponse";
import type {FrontendToolPlanItem} from "./frontend-tool-planner";
import type {ToolCallResultPatch} from "./tool-call-message-part";
import {
    createFrontendToolErrorPatch,
    FrontendToolCancelledError,
    invokeFrontendTool,
    isFrontendToolCancellation,
    normalizeFrontendToolOutput
} from "./tool-execution";

export type FrontendToolExecutionEvent =
    | {type: "started"; toolCallId: string; startedAt: number}
    | {
          type: "finished";
          toolCallId: string;
          patch: ToolCallResultPatch;
          startedAt?: number;
          completedAt?: number;
      }
    | {
          type: "cancelled";
          toolCallId?: string;
          startedAt?: number;
          completedAt: number;
      };

type FrontendToolExecutorOptions = {
    abortSignal: AbortSignal;
    getMessages: () => readonly ThreadMessage[];
    now?: () => number;
};

export async function* executeFrontendToolPlan(
    plan: readonly FrontendToolPlanItem[],
    {abortSignal, getMessages, now = Date.now}: FrontendToolExecutorOptions
): AsyncGenerator<FrontendToolExecutionEvent> {
    for (const item of plan) {
        if (abortSignal.aborted) {
            yield {type: "cancelled", completedAt: now()};
            return;
        }
        if (item.kind === "await-human") continue;
        if (item.kind === "final-error") {
            const response = ChatToolResponse.error(item.message);
            yield {
                type: "finished",
                toolCallId: item.toolCall.toolCallId,
                patch: {result: response.result, isError: response.isError}
            };
            continue;
        }

        const startedAt = now();
        yield {type: "started", toolCallId: item.toolCall.toolCallId, startedAt};

        try {
            const output = await invokeFrontendTool(
                item.tool,
                item.toolCall,
                abortSignal,
                getMessages()
            );
            if (abortSignal.aborted) throw new FrontendToolCancelledError();
            const patch = await normalizeFrontendToolOutput(
                item.tool,
                item.toolCall,
                output,
                abortSignal
            );
            if (abortSignal.aborted) throw new FrontendToolCancelledError();
            yield {
                type: "finished",
                toolCallId: item.toolCall.toolCallId,
                patch,
                startedAt,
                completedAt: now()
            };
        } catch (error) {
            if (isFrontendToolCancellation(error) || abortSignal.aborted) {
                yield {
                    type: "cancelled",
                    toolCallId: item.toolCall.toolCallId,
                    startedAt,
                    completedAt: now()
                };
                return;
            }
            yield {
                type: "finished",
                toolCallId: item.toolCall.toolCallId,
                patch: createFrontendToolErrorPatch(error),
                startedAt,
                completedAt: now()
            };
        }
    }
}
