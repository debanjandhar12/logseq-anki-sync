import {z} from "zod";
import {LogseqReversibleCommandCodec} from "./commands";
import {LogseqReversibleTransactionTracker} from "./LogseqReversibleTransactionTracker";

const LogseqReversibleTransactionTrackerDataSchema = z.object({
    commands: z.array(z.lazy(() => LogseqReversibleCommandCodec)),
    appliedCommandCount: z.number().int().nonnegative(),
    changedPages: z.array(z.string()),
    changedAssets: z.array(z.string()).default([])
});

export const LogseqReversibleTransactionTrackerCodec = z.codec(
    LogseqReversibleTransactionTrackerDataSchema,
    z.instanceof(LogseqReversibleTransactionTracker),
    {
        decode: ({commands, appliedCommandCount, changedPages, changedAssets}) => {
            if (appliedCommandCount > commands.length) {
                throw new Error("Applied command count exceeds command count");
            }
            commands.forEach((command, index) => {
                const expectedStatus = index < appliedCommandCount ? "executed" : "new";
                if (command.getCommandState().status !== expectedStatus) {
                    throw new Error("Tracker command status does not match applied command count");
                }
            });
            const tracker = new LogseqReversibleTransactionTracker({
                appliedCommandCount,
                changedAssets,
                changedPages
            });
            for (const command of commands) tracker.addCommand(command);
            return tracker;
        },
        encode: (tracker) => ({
            commands: tracker.getCommands(),
            appliedCommandCount: tracker.getAppliedCommandCount(),
            changedPages: tracker.getChangedPages(),
            changedAssets: tracker.getChangedAssets()
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
