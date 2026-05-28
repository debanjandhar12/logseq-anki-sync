export interface ChatCommand {
    execute(): Promise<void>;
}

export interface ChatRuntimeCommand {
    type: string;
    payload?: any;
}
