import type {ChatCommand} from "./types";

/**
 * Registry that maps command types to their implementations.
 */
export class CommandRegistry {
    private static commands = new Map<string, ChatCommand>();

    static register(command: ChatCommand): void {
        CommandRegistry.commands.set(command.type, command);
    }

    static get(type: string): ChatCommand | undefined {
        return CommandRegistry.commands.get(type);
    }

    static execute(type: string): Promise<void> {
        const command = CommandRegistry.get(type);
        if (!command) {
            throw new Error(`Command not found: ${type}`);
        }
        return command.execute();
    }
}
