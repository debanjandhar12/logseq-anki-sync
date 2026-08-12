import type {ThreadRuntime} from "@assistant-ui/react";
import {ThreadStore} from "src/core/stores/thread-store/ThreadStore";
import {createLogger, LoggerCategory} from "src/logger";
import pkg from "../../../package.json";
import {
    getActiveAssistantMessageTarget,
    type ToolTurnTarget,
    terminateToolTurn,
    USER_TERMINATED_OPERATION
} from "./terminateToolTurn";

export interface StopThreadResult {
    didStop: boolean;
    kind: "active-run" | "required-action" | "nothing-to-stop";
    persistenceFailed?: boolean;
}

const pendingStops = new Map<string, {signature: string; promise: Promise<StopThreadResult>}>();
const RUN_END_TIMEOUT_MS = 10_000;
const logger = createLogger(LoggerCategory.CHAT_UI);

export function stopThread(options: {
    threadId: string;
    runtime: ThreadRuntime;
    target?: ToolTurnTarget;
    errorMessage?: string;
}): Promise<StopThreadResult> {
    const repository = options.runtime.export();
    const target = options.target ?? getActiveAssistantMessageTarget(repository);
    const key = `${options.threadId}:${target?.messageId ?? "active-run"}`;
    const signature = JSON.stringify({
        target,
        errorMessage: options.errorMessage ?? USER_TERMINATED_OPERATION
    });
    const pending = pendingStops.get(key);
    if (pending) {
        return pending.signature === signature
            ? pending.promise
            : pending.promise.then(() => ({didStop: false, kind: "nothing-to-stop"}));
    }

    const operation = stopThreadOnce({...options, target}).finally(() => pendingStops.delete(key));
    pendingStops.set(key, {signature, promise: operation});
    return operation;
}

async function stopThreadOnce(options: {
    threadId: string;
    runtime: ThreadRuntime;
    target: ToolTurnTarget | null;
    errorMessage?: string;
}): Promise<StopThreadResult> {
    const wasRunning = options.runtime.getState().isRunning;
    const wasRequiredAction = options.runtime
        .getState()
        .messages.some(
            (message) =>
                message.id === options.target?.messageId &&
                message.role === "assistant" &&
                message.status.type === "requires-action"
        );
    if (!wasRunning && !wasRequiredAction) {
        return {didStop: false, kind: "nothing-to-stop"};
    }

    if (wasRunning) {
        await cancelActiveRun(options.runtime);
    }

    let didTerminateTools = false;
    let persistenceFailed = false;
    if (options.target) {
        const result = terminateToolTurn(options.runtime.export(), {
            target: options.target,
            errorMessage: options.errorMessage ?? USER_TERMINATED_OPERATION
        });
        didTerminateTools = result.didChange;
        if (result.didChange) {
            options.runtime.import(result.repository);
            try {
                await persistTerminatedToolTurn({
                    threadId: options.threadId,
                    target: options.target,
                    errorMessage: options.errorMessage ?? USER_TERMINATED_OPERATION,
                    terminatedRepository: result.repository
                });
            } catch (error) {
                logger.error("Failed to persist terminated chat state", error);
                persistenceFailed = true;
            }
        }
    }

    if (!wasRunning && !didTerminateTools) {
        return {didStop: false, kind: "nothing-to-stop"};
    }

    return {
        didStop: true,
        kind: wasRunning ? "active-run" : "required-action",
        ...(persistenceFailed ? {persistenceFailed: true} : {})
    };
}

async function cancelActiveRun(runtime: ThreadRuntime): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            unsubscribe();
            reject(new Error("Timed out while stopping the current chat run"));
        }, RUN_END_TIMEOUT_MS);
        const unsubscribe = runtime.unstable_on("runEnd", () => {
            clearTimeout(timeout);
            unsubscribe();
            resolve();
        });
        runtime.cancelRun();
    });
}

async function persistTerminatedToolTurn(options: {
    threadId: string;
    target: ToolTurnTarget;
    errorMessage: string;
    terminatedRepository: ReturnType<ThreadRuntime["export"]>;
}): Promise<void> {
    await ThreadStore.updateThread(options.threadId, (threadData) => {
        const latestRepository = threadData?.exportedMessageRepository ?? {
            headId: null,
            messages: []
        };
        const terminatedLatestRepository = terminateToolTurn(latestRepository, {
            target: options.target,
            errorMessage: options.errorMessage
        }).repository;
        const repository = mergeTargetAncestry(
            options.terminatedRepository,
            terminatedLatestRepository,
            options.target.messageId
        );

        if (!threadData) {
            const now = new Date();
            return {
                type: "save",
                threadData: {
                    remoteId: options.threadId,
                    status: "regular",
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
        return {type: "save", threadData, result: undefined};
    });
}

function mergeTargetAncestry(
    terminatedRepository: ReturnType<ThreadRuntime["export"]>,
    latestRepository: ReturnType<ThreadRuntime["export"]>,
    terminatedMessageId: string
): ReturnType<ThreadRuntime["export"]> {
    const terminatedItemsById = new Map(
        terminatedRepository.messages.map((item) => [item.message.id, item] as const)
    );
    const latestItemsById = new Map(
        latestRepository.messages.map((item) => [item.message.id, item] as const)
    );
    const ancestryIds: string[] = [];
    const visitedIds = new Set<string>();
    let messageId: string | null = terminatedMessageId;
    while (messageId && !visitedIds.has(messageId)) {
        visitedIds.add(messageId);
        ancestryIds.push(messageId);
        messageId = terminatedItemsById.get(messageId)?.parentId ?? null;
    }
    ancestryIds.reverse();

    const ancestryIdSet = new Set(ancestryIds);
    const ancestry = ancestryIds.map((id) => {
        const terminatedItem = terminatedItemsById.get(id);
        if (!terminatedItem) {
            throw new Error(`Unable to restore message ${id} while saving terminated state`);
        }
        const latestItem = latestItemsById.get(id);
        if (id !== terminatedMessageId || !latestItem) {
            return latestItem ? {...latestItem, parentId: terminatedItem.parentId} : terminatedItem;
        }
        return mergeTerminatedMessageItem(terminatedItem, latestItem);
    });
    return {
        headId: latestRepository.headId ?? terminatedRepository.headId,
        messages: [
            ...ancestry,
            ...latestRepository.messages.filter(({message}) => !ancestryIdSet.has(message.id))
        ]
    };
}

function mergeTerminatedMessageItem(
    terminatedItem: ReturnType<ThreadRuntime["export"]>["messages"][number],
    latestItem: ReturnType<ThreadRuntime["export"]>["messages"][number]
): ReturnType<ThreadRuntime["export"]>["messages"][number] {
    if (terminatedItem.message.role !== "assistant" || latestItem.message.role !== "assistant") {
        return terminatedItem;
    }

    const latestToolCalls = new Map<string, (typeof terminatedItem.message.content)[number]>();
    for (const part of latestItem.message.content) {
        if (part.type === "tool-call") latestToolCalls.set(part.toolCallId, part);
    }
    const content = terminatedItem.message.content.map((part) => {
        if (part.type !== "tool-call") return part;
        const latestPart = latestToolCalls.get(part.toolCallId);
        if (!latestPart || latestPart.type !== "tool-call") return part;
        if (latestPart.result !== undefined) return latestPart;
        return {...latestPart, ...part};
    });

    return {
        ...latestItem,
        parentId: terminatedItem.parentId,
        message: {
            ...latestItem.message,
            content,
            status: terminatedItem.message.status
        }
    };
}
