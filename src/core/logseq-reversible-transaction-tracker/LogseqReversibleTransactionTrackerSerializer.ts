import {z} from "zod";
import {LogseqReversibleCommandCodec} from "./commands";
import {migrateLegacyCommand} from "./LogseqReversibleTransactionCommandSerializer";
import {LogseqReversibleTransactionTracker} from "./LogseqReversibleTransactionTracker";

const LogseqReversibleTransactionTrackerDataSchema = z.object({
    version: z.literal(2),
    commands: z.array(LogseqReversibleCommandCodec),
    appliedCommandCount: z.number().int().nonnegative(),
    changedPages: z.array(z.string())
});

export const LogseqReversibleTransactionTrackerCodec = z.codec(
    LogseqReversibleTransactionTrackerDataSchema,
    z.instanceof(LogseqReversibleTransactionTracker),
    {
        decode: ({commands, appliedCommandCount, changedPages}) => {
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
                changedPages
            });
            for (const command of commands) tracker.addCommand(command);
            return tracker;
        },
        encode: (tracker) => ({
            version: 2 as const,
            commands: tracker.getCommands(),
            appliedCommandCount: tracker.getAppliedCommandCount(),
            changedPages: tracker.getChangedPages()
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
            migrateLegacyTracker(json) as SerializedLogseqReversibleTransactionTracker
        );
    }
}

function migrateLegacyTracker(json: unknown): unknown {
    if (typeof json !== "object" || json === null || !("commands" in json)) return json;
    const tracker = json as Record<string, unknown>;
    const commands = Array.isArray(tracker.commands)
        ? tracker.commands.map((command) => migrateLegacyCommand(command))
        : tracker.commands;
    return {
        version: 2,
        commands,
        appliedCommandCount: tracker.appliedCommandCount ?? 0,
        changedPages: tracker.changedPages ?? []
    };
}
