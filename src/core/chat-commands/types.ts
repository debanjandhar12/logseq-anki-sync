export interface ChatCommand {
    readonly type: string;
    execute(): Promise<void>;
}

export interface ChatRuntimeCommand {
    type: string;
    payload?: any;
}
