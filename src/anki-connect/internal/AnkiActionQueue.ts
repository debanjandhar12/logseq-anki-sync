import * as AnkiConnect from "../AnkiConnect";
import { AnkiAction } from "../types";

export class AnkiActionQueue {
    private queue: AnkiAction[] = [];

    push(action: AnkiAction): void {
        this.queue.push(action);
    }

    async execute(): Promise<any[]> {
        if (this.queue.length === 0) {
            return [];
        }

        const result = await AnkiConnect.invoke("multi", {
            actions: this.queue,
        });
        
        return result;
    }

    clear(): void {
        this.queue = [];
    }

    isEmpty(): boolean {
        return this.queue.length === 0;
    }

    get length(): number {
        return this.queue.length;
    }

    getActions(): AnkiAction[] {
        return this.queue;
    }
}
