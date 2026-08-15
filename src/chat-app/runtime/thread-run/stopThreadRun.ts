import type {ExportedMessageRepository, ThreadRuntime} from "@assistant-ui/react";
import {ThreadStore} from "src/core/stores/thread-store/ThreadStore";
import {createLogger, LoggerCategory} from "src/logger";
import pkg from "../../../../package.json";
import {isThreadRunActive} from "./ThreadRunTracker";
import {
    getActiveAssistantMessageTarget,
    type ToolTurnTarget,
    terminateToolTurn,
    USER_TERMINATED_OPERATION
} from "./terminateToolTurn";

export interface StopThreadRunResult {
    didStop: boolean;
    persistenceFailed?: boolean;
}

const pendingStops = new Map<string, Promise<StopThreadRunResult>>();
const RUN_END_TIMEOUT_MS = 10_000;
const logger = createLogger(LoggerCategory.CHAT_UI);

/**
 * Stops the current turn. Same-thread callers share the complete cancellation-through-persistence
 * operation so none can bypass the runEnd boundary while assistant-ui is still settling history.
 */
export function stopThreadRun(options: {
    threadId: string;
    runtime: ThreadRuntime;
    errorMessage?: string;
}): Promise<StopThreadRunResult> {
    const pending = pendingStops.get(options.threadId);
    if (pending) return pending;

    const operation = stopThreadRunOnce(options).finally(() => {
        if (pendingStops.get(options.threadId) === operation) {
            pendingStops.delete(options.threadId);
        }
    });
    pendingStops.set(options.threadId, operation);
    return operation;
}

async function stopThreadRunOnce(options: {
    threadId: string;
    runtime: ThreadRuntime;
    errorMessage?: string;
}): Promise<StopThreadRunResult> {
    const errorMessage = options.errorMessage ?? USER_TERMINATED_OPERATION;
    const target = getActiveAssistantMessageTarget(options.runtime.export());
    const hadTrackedRun = isThreadRunActive(options.threadId);
    const wasRunning = hadTrackedRun || options.runtime.getState().isRunning;

    if (wasRunning) {
        await cancelActiveRun(options.runtime, hadTrackedRun ? options.threadId : undefined);
    }
    if (!target) return {didStop: wasRunning};

    const terminated = terminateToolTurn(options.runtime.export(), {target, errorMessage});
    if (!terminated.didChange) return {didStop: wasRunning};

    options.runtime.import(terminated.repository);
    try {
        await persistTerminatedToolTurn({
            threadId: options.threadId,
            target,
            errorMessage,
            terminatedRepository: terminated.repository
        });
        return {didStop: true};
    } catch (error) {
        logger.error("Failed to persist terminated chat state", error);
        return {didStop: true, persistenceFailed: true};
    }
}

async function cancelActiveRun(runtime: ThreadRuntime, trackedThreadId?: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        let didSettle = false;
        const settle = (error?: Error) => {
            if (didSettle) return;
            didSettle = true;
            clearTimeout(timeout);
            unsubscribe();
            error ? reject(error) : resolve();
        };
        const timeout = setTimeout(
            () => settle(new Error("Timed out while stopping the current chat run")),
            RUN_END_TIMEOUT_MS
        );
        // Subscribe before cancellation so a synchronous runEnd cannot be missed.
        const unsubscribe = runtime.unstable_on("runEnd", () => settle());

        // The tracked generator may have ended between the initial check and subscription.
        if (trackedThreadId && !isThreadRunActive(trackedThreadId)) {
            settle();
            return;
        }

        try {
            runtime.cancelRun();
        } catch (error) {
            settle(error instanceof Error ? error : new Error(String(error)));
        }
    });
}

async function persistTerminatedToolTurn(options: {
    threadId: string;
    target: ToolTurnTarget;
    errorMessage: string;
    terminatedRepository: ExportedMessageRepository;
}): Promise<void> {
    await ThreadStore.updateThread(options.threadId, (threadData) => {
        const storedRepository = threadData?.exportedMessageRepository ?? {
            headId: null,
            messages: []
        };
        const repositoryWithTarget = ensureTargetAncestry(
            storedRepository,
            options.terminatedRepository,
            options.target.messageId
        );
        const repository = terminateToolTurn(repositoryWithTarget, {
            target: options.target,
            errorMessage: options.errorMessage
        }).repository;

        if (!threadData) {
            const now = new Date();
            return {
                type: "save" as const,
                threadData: {
                    remoteId: options.threadId,
                    status: "regular" as const,
                    exportedMessageRepository: repository,
                    custom: {
                        createdAt: now,
                        updatedAt: now,
                        createdByPluginVersion: pkg.version
                    }
                },
                result: undefined
            };
        }

        threadData.exportedMessageRepository = repository;
        threadData.custom.updatedAt = new Date();
        return {type: "save" as const, threadData, result: undefined};
    });
}

function ensureTargetAncestry(
    storedRepository: ExportedMessageRepository,
    sourceRepository: ExportedMessageRepository,
    targetMessageId: string
): ExportedMessageRepository {
    const sourceById = new Map(
        sourceRepository.messages.map((item) => [item.message.id, item] as const)
    );
    const storedById = new Map(
        storedRepository.messages.map((item) => [item.message.id, item] as const)
    );
    const ancestryIds: string[] = [];
    const visitedIds = new Set<string>();
    let messageId: string | null = targetMessageId;
    while (messageId && !visitedIds.has(messageId)) {
        visitedIds.add(messageId);
        ancestryIds.push(messageId);
        messageId = sourceById.get(messageId)?.parentId ?? null;
    }
    ancestryIds.reverse();

    const ancestry = ancestryIds.map((id) => storedById.get(id) ?? sourceById.get(id));
    if (ancestry.some((item) => item === undefined)) {
        throw new Error(`Unable to restore ancestry for stopped message ${targetMessageId}`);
    }
    const ancestryIdSet = new Set(ancestryIds);
    const hasValidStoredHead =
        storedRepository.headId !== null && storedById.has(storedRepository.headId);

    return {
        headId: hasValidStoredHead ? storedRepository.headId : targetMessageId,
        messages: [
            ...(ancestry as ExportedMessageRepository["messages"]),
            ...storedRepository.messages.filter(({message}) => !ancestryIdSet.has(message.id))
        ]
    };
}
