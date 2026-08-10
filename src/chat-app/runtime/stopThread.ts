import type {ThreadRuntime} from "@assistant-ui/react";
import {ThreadStore} from "src/core/stores/thread-store/ThreadStore";
import {createLogger, LoggerCategory} from "src/logger";
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
                await persistRepository(options.threadId, result.repository);
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

async function persistRepository(
    threadId: string,
    repository: ReturnType<ThreadRuntime["export"]>
): Promise<void> {
    const threadData = await ThreadStore.loadThread(threadId);
    if (!threadData) {
        throw new Error(`Unable to load thread ${threadId} while saving its terminated state`);
    }
    threadData.exportedMessageRepository = repository;
    threadData.custom.updatedAt = new Date();
    await ThreadStore.saveThread(threadId, threadData);
}
