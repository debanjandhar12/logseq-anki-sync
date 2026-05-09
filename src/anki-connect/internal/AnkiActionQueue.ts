import {chunk, flatten} from "lodash";
import {createLogger, LoggerCategory} from "../../logger";
import * as AnkiConnect from "../AnkiConnect";
import type {AnkiAction, AnkiActionResult} from "../types";

const logger = createLogger(LoggerCategory.LazyAnkiNoteManagerInternal);

export class AnkiActionQueue {
    private queue: AnkiAction[] = [];
    private readonly BATCH_SIZE: number;

    constructor(batchSize: number = 128) {
        this.BATCH_SIZE = batchSize;
    }

    push(action: AnkiAction): void {
        this.queue.push(action);
    }

    async execute(): Promise<AnkiActionResult[]> {
        if (this.queue.length === 0) {
            return [];
        }

        // Create batches and execute multi action to avoid overwhelming anki
        const batches = chunk(this.queue, this.BATCH_SIZE);
        const results: AnkiActionResult[][] = [];

        for (const batch of batches) {
            const batchResult = await AnkiConnect.invoke("multi", {
                actions: batch
            });
            results.push(batchResult);
        }

        return flatten(results);
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
