import {LogseqFakeableTransactionCommandSerializer} from "./LogseqFakeableTransactionCommandSerializer";
import {LogseqFakeableTransactionTracker} from "./LogseqFakeableTransactionTracker";
import type {SerializedLogseqFakeableTransactionTracker} from "./types";

/**
 * Serializes and deserializes a LogseqFakeableTransactionTracker to and from JSON.
 */
export class LogseqFakeableTransactionTrackerSerializer {
    static serialize(
        tracker: LogseqFakeableTransactionTracker
    ): SerializedLogseqFakeableTransactionTracker {
        return {
            uuidGenerationSeed: tracker.getUuidGenerationSeed(),
            commands: tracker
                .getCommands()
                .map(LogseqFakeableTransactionCommandSerializer.serialize)
        };
    }

    static deserialize(
        json: SerializedLogseqFakeableTransactionTracker
    ): LogseqFakeableTransactionTracker {
        const tracker = new LogseqFakeableTransactionTracker();
        tracker.setUuidGenerationSeed(json.uuidGenerationSeed);
        for (const command of json.commands) {
            tracker.addCommand(LogseqFakeableTransactionCommandSerializer.deserialize(command));
        }

        return tracker;
    }
}
