export interface ChatCommand {
    execute(): Promise<void>;
}

export type ChatRuntimeCommand =
    | {type: "new-thread"}
    | {type: "clear-composer"}
    | {type: "add-attachment"; payload: {uuid: string}}
    | {type: "set-composer-text"; payload: {text: string}};
