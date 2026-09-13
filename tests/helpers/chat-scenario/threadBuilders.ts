import {
    type CompleteAttachment,
    ExportedMessageRepository,
    fromThreadMessageLike,
    type ThreadAssistantMessage,
    type ThreadMessageLike,
    type ThreadUserMessage
} from "@assistant-ui/core";
import pkg from "../../../package.json";
import type {ThreadFileData} from "../../../src/core/stores/thread-store/types";

const BASE_TIME = Date.parse("2026-01-01T00:00:00.000Z");
const completedStatus = {type: "complete", reason: "stop"} as const;
const messageDate = (index = 0): Date => new Date(BASE_TIME + index * 1000);

export interface UserMessageOptions {
    id: string;
    text: string | string[];
    attachments?: CompleteAttachment[];
    createdAt?: Date;
}

export interface AssistantMessageOptions {
    id: string;
    text?: string;
    reasoning?: string;
    createdAt?: Date;
}

function validateId(id: string, label: string): void {
    if (typeof id !== "string" || !id.trim()) {
        throw new Error(`${label} must be a nonempty ID`);
    }
}

export function userMessage({
    id,
    text,
    attachments = [],
    createdAt = messageDate()
}: UserMessageOptions): ThreadUserMessage {
    validateId(id, "User message ID");
    const message = fromThreadMessageLike(
        {
            id,
            role: "user",
            content: (typeof text === "string" ? [text] : text).map((part) => ({
                type: "text",
                text: part
            })),
            attachments,
            createdAt: new Date(createdAt)
        },
        id,
        completedStatus
    );
    if (message.role !== "user") throw new Error("Expected a user message");
    return message;
}

export function assistantMessage({
    id,
    text,
    reasoning,
    createdAt = messageDate()
}: AssistantMessageOptions): ThreadAssistantMessage {
    validateId(id, "Assistant message ID");
    const message = fromThreadMessageLike(
        {
            id,
            role: "assistant",
            content: [
                ...(reasoning === undefined ? [] : [{type: "reasoning" as const, text: reasoning}]),
                ...(text === undefined ? [] : [{type: "text" as const, text}])
            ],
            status: completedStatus,
            createdAt: new Date(createdAt)
        },
        id,
        completedStatus
    );
    if (message.role !== "assistant") throw new Error("Expected an assistant message");
    return message;
}

export interface RepositoryNode {
    message: ThreadMessageLike;
    parentId: string | null;
}

export function buildRepository(
    nodes: readonly RepositoryNode[],
    {headId}: {headId: string | null}
): ExportedMessageRepository {
    const ids = new Set<string>();
    const parents = new Set<string>();
    for (const {message, parentId} of nodes) {
        validateId(message.id, "Repository message ID");
        if (ids.has(message.id)) throw new Error(`Duplicate message ID: ${message.id}`);
        if (parentId !== null) {
            if (!ids.has(parentId)) {
                throw new Error(`Parent ${parentId} must precede child ${message.id}`);
            }
            parents.add(parentId);
        }
        ids.add(message.id);
    }
    if (nodes.length === 0) {
        if (headId !== null) throw new Error("An empty repository must have a null head ID");
    } else {
        validateId(headId, "Repository head ID");
        if (!ids.has(headId)) throw new Error(`Head message not found: ${headId}`);
        if (parents.has(headId)) throw new Error(`Head must be a leaf: ${headId}`);
    }
    // Supply dates even for caller-provided message-like nodes, avoiding conversion's wall clock.
    return ExportedMessageRepository.fromBranchableArray(
        nodes.map(({message, parentId}, index) => ({
            message: {...message, createdAt: new Date(message.createdAt ?? messageDate(index))},
            parentId
        })),
        {headId}
    );
}

export interface BuildThreadOptions {
    id: string;
    title: string;
    repository: ExportedMessageRepository;
    updatedAt?: Date;
}

export function buildThread({
    id,
    title,
    repository,
    updatedAt
}: BuildThreadOptions): ThreadFileData {
    validateId(id, "Thread ID");
    const times = repository.messages.map(({message}) => new Date(message.createdAt).getTime());
    return {
        remoteId: id,
        title,
        status: "regular",
        exportedMessageRepository: repository,
        custom: {
            createdAt: new Date(times.length ? Math.min(...times) : BASE_TIME),
            updatedAt: new Date(updatedAt ?? (times.length ? Math.max(...times) : BASE_TIME)),
            createdByPluginVersion: pkg.version
        }
    };
}

export interface LinearTurn {
    user: string | string[];
    assistant: string;
    attachments?: CompleteAttachment[];
}

export interface BuildLinearThreadOptions {
    id?: string;
    title?: string;
    turns: LinearTurn[];
}

export function buildLinearThread({
    id = "linear-thread",
    title = `Conversation ${id}`,
    turns
}: BuildLinearThreadOptions): ThreadFileData {
    const nodes: RepositoryNode[] = [];
    for (const [index, turn] of turns.entries()) {
        const userId = `${id}:u${index}`;
        const assistantId = `${id}:a${index}`;
        nodes.push(
            {
                parentId: index === 0 ? null : `${id}:a${index - 1}`,
                message: userMessage({
                    id: userId,
                    text: turn.user,
                    attachments: turn.attachments,
                    createdAt: messageDate(index * 2)
                })
            },
            {
                parentId: userId,
                message: assistantMessage({
                    id: assistantId,
                    text: turn.assistant,
                    createdAt: messageDate(index * 2 + 1)
                })
            }
        );
    }
    return buildThread({
        id,
        title,
        repository: buildRepository(nodes, {headId: nodes.at(-1)?.message.id ?? null})
    });
}

export interface BranchValues {
    u0: string;
    a0: string;
    u1Original: string;
    a1Original: string;
    a1Refreshed: string;
    u1Edited: string;
    a1Edited: string;
}

export interface BuildBranchedThreadOptions {
    id?: string;
    title?: string;
    head?: "original" | "refreshed" | "edited";
}

export interface BranchedThread {
    thread: ThreadFileData;
    ids: BranchValues;
    texts: BranchValues;
}

export function buildBranchedThread({
    id = "branched-thread",
    title = `Branched conversation ${id}`,
    head = "edited"
}: BuildBranchedThreadOptions = {}): BranchedThread {
    const ids: BranchValues = {
        u0: `${id}:u0`,
        a0: `${id}:a0`,
        u1Original: `${id}:u1-original`,
        a1Original: `${id}:a1-original`,
        a1Refreshed: `${id}:a1-refreshed`,
        u1Edited: `${id}:u1-edited`,
        a1Edited: `${id}:a1-edited`
    };
    const texts: BranchValues = {
        u0: `Shared opening question [${ids.u0}]`,
        a0: `Shared opening answer [${ids.a0}]`,
        u1Original: `Original follow-up question [${ids.u1Original}]`,
        a1Original: `Original follow-up answer [${ids.a1Original}]`,
        a1Refreshed: `Refreshed follow-up answer [${ids.a1Refreshed}]`,
        u1Edited: `Edited follow-up question [${ids.u1Edited}]`,
        a1Edited: `Edited follow-up answer [${ids.a1Edited}]`
    };
    const topology: [keyof BranchValues, keyof BranchValues | null][] = [
        ["u0", null],
        ["a0", "u0"],
        ["u1Original", "a0"],
        ["a1Original", "u1Original"],
        ["a1Refreshed", "u1Original"],
        ["u1Edited", "a0"],
        ["a1Edited", "u1Edited"]
    ];
    const nodes = topology.map(([key, parent], index) => ({
        parentId: parent === null ? null : ids[parent],
        message: (key.startsWith("u") ? userMessage : assistantMessage)({
            id: ids[key],
            text: texts[key],
            createdAt: messageDate(index)
        })
    }));
    const heads = {original: ids.a1Original, refreshed: ids.a1Refreshed, edited: ids.a1Edited};
    return {
        thread: buildThread({id, title, repository: buildRepository(nodes, {headId: heads[head]})}),
        ids,
        texts
    };
}

export interface BuildThreadListOptions {
    count?: number;
    idPrefix?: string;
    baseTime?: Date;
    longTitleIndex?: number;
}

/** Returns oldest-first seeds; ThreadStore.listThreads supplies newest-first presentation. */
export function buildThreadList({
    count = 3,
    idPrefix = "history-thread",
    baseTime = messageDate(),
    longTitleIndex
}: BuildThreadListOptions = {}): ThreadFileData[] {
    if (!Number.isInteger(count) || count < 0) {
        throw new Error("Thread count must be a nonnegative integer");
    }
    if (
        longTitleIndex !== undefined &&
        (!Number.isInteger(longTitleIndex) || longTitleIndex < 0 || longTitleIndex >= count)
    ) {
        throw new Error("Long title index must refer to a thread in the list");
    }
    return Array.from({length: count}, (_, index) => {
        const id = `${idPrefix}-${index}`;
        const title = `History conversation ${id}${
            index === longTitleIndex
                ? ` ${"Long title for truncation and responsive history layout. ".repeat(8)}`
                : ""
        }`;
        const thread = buildLinearThread({
            id,
            title,
            turns: [{user: `History question [${id}]`, assistant: `History answer [${id}]`}]
        });
        thread.custom.updatedAt = new Date(baseTime.getTime() + index * 1000);
        return thread;
    });
}
