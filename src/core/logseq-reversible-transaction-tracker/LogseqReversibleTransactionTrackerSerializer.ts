import {z} from "zod";
import {LogseqReversibleCommandCodec} from "./commands";
import {LogseqReversibleTransactionTracker} from "./LogseqReversibleTransactionTracker";

const LogseqReversibleTransactionTrackerDataSchema = z.object({
    uuidGenerationSeed: z.uuid(),
    commands: z.array(LogseqReversibleCommandCodec)
});

export const LogseqReversibleTransactionTrackerCodec = z.codec(
    LogseqReversibleTransactionTrackerDataSchema,
    z.instanceof(LogseqReversibleTransactionTracker),
    {
        decode: ({uuidGenerationSeed, commands}) => {
            const tracker = new LogseqReversibleTransactionTracker(uuidGenerationSeed);
            for (const command of commands) tracker.addCommand(command);
            return tracker;
        },
        encode: (tracker) => ({
            uuidGenerationSeed: tracker.getUUIDGenerationSeed(),
            commands: tracker.getCommands()
        })
    }
);

export type SerializedLogseqReversibleTransactionTracker = z.input<
    typeof LogseqReversibleTransactionTrackerCodec
>;

export class LogseqReversibleTransactionTrackerSerializer {
    public static serialize(
        tracker: LogseqReversibleTransactionTracker
    ): SerializedLogseqReversibleTransactionTracker {
        return z.encode(LogseqReversibleTransactionTrackerCodec, tracker);
    }

    public static deserialize(json: unknown): LogseqReversibleTransactionTracker {
        return z.decode(
            LogseqReversibleTransactionTrackerCodec,
            json as SerializedLogseqReversibleTransactionTracker
        );
    }
}
