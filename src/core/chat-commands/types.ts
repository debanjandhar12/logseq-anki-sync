export interface ChatCommand {
    execute(): Promise<void>;
}

export const CHAT_COMMAND_TYPES = {
    INIT_AI_CHAT: "init-ai-chat",
    OPEN_AI_CHAT: "open-ai-chat",
    NEW_THREAD: "new-thread"
} as const;

export type ChatCommandType = (typeof CHAT_COMMAND_TYPES)[keyof typeof CHAT_COMMAND_TYPES];

export const CHAT_RUNTIME_COMMAND_TYPES = {
    NEW_THREAD: "new-thread"
} as const;

export type ChatRuntimeCommandType =
    (typeof CHAT_RUNTIME_COMMAND_TYPES)[keyof typeof CHAT_RUNTIME_COMMAND_TYPES];

export interface ChatRuntimeCommand {
    type: ChatRuntimeCommandType;
}
