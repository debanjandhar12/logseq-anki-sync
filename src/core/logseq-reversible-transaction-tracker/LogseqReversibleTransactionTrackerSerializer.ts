import {z} from "zod";
import {LogseqReversibleCommandCodec} from "./commands";
import {LogseqReversibleTransactionTracker} from "./LogseqReversibleTransactionTracker";

const LogseqReversibleTransactionTrackerDataSchema = z.object({
    commands: z.array(LogseqReversibleCommandCodec)
});

export const LogseqReversibleTransactionTrackerCodec = z.codec(
    LogseqReversibleTransactionTrackerDataSchema,
    z.instanceof(LogseqReversibleTransactionTracker),
    {
        decode: ({commands}) => {
            const tracker = new LogseqReversibleTransactionTracker();
            for (const command of commands) tracker.addCommand(command);
            return tracker;
        },
        encode: (tracker) => ({
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
