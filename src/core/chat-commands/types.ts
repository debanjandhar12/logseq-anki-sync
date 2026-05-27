export interface ChatCommand {
    execute(): Promise<void>;
}
