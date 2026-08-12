import type {ExportedMessageRepository, ThreadMessage, ThreadRuntime} from "@assistant-ui/react";
import type {LogseqReversibleTransactionTracker} from "src/core/logseq-reversible-transaction-tracker";
import {ThreadStore} from "src/core/stores/thread-store/ThreadStore";
import {createLogseqReversibleTransactionTrackerArtifact} from "../tools/transaction/createLogseqReversibleTransactionTrackerArtifact";

export interface LogseqReversibleTransactionTrackerArtifactLocation {
    messageId: string;
    toolCallId: string;
}

export function patchLogseqReversibleTransactionTrackerArtifact(
    repository: ExportedMessageRepository,
    location: LogseqReversibleTransactionTrackerArtifactLocation,
    tracker: LogseqReversibleTransactionTracker
): ExportedMessageRepository {
    let foundToolCall = false;
    const trackerArtifact = createLogseqReversibleTransactionTrackerArtifact(tracker);
    const messages = repository.messages.map((item) => {
        if (item.message.id !== location.messageId) return item;

        const content = item.message.content.map((part) => {
            if (part.type !== "tool-call" || part.toolCallId !== location.toolCallId) return part;
            foundToolCall = true;
            return {
                ...part,
                artifact: {
                    ...(typeof part.artifact === "object" && part.artifact !== null
                        ? part.artifact
                        : {}),
                    ...trackerArtifact
                }
            };
        });

        return {
            ...item,
            message: {...item.message, content} as ThreadMessage
        };
    });

    if (!foundToolCall) {
        throw new Error(
            `Unable to find tracker artifact at message ${location.messageId}, tool call ${location.toolCallId}`
        );
    }

    return {...repository, messages};
}

export async function persistLogseqReversibleTransactionTrackerArtifact(options: {
    threadId: string;
    runtime?: ThreadRuntime;
    location: LogseqReversibleTransactionTrackerArtifactLocation;
    tracker: LogseqReversibleTransactionTracker;
}): Promise<void> {
    if (options.runtime) {
        patchRuntimeThreadTrackerArtifact({
            runtime: options.runtime,
            location: options.location,
            tracker: options.tracker
        });
    }

    await ThreadStore.updateThread(options.threadId, (threadData) => {
        if (!threadData?.exportedMessageRepository) {
            return {type: "skip", result: undefined};
        }

        threadData.exportedMessageRepository = patchLogseqReversibleTransactionTrackerArtifact(
            threadData.exportedMessageRepository,
            options.location,
            options.tracker
        );
        threadData.custom.updatedAt = new Date();
        return {type: "save", threadData, result: undefined};
    });
}

function patchRuntimeThreadTrackerArtifact(options: {
    runtime: ThreadRuntime;
    location: LogseqReversibleTransactionTrackerArtifactLocation;
    tracker: LogseqReversibleTransactionTracker;
}): void {
    const runtimeRepository = patchLogseqReversibleTransactionTrackerArtifact(
        options.runtime.export(),
        options.location,
        options.tracker
    );
    options.runtime.import(runtimeRepository);
}
