import {z} from "zod";
import {
    type LogseqReversibleCommand,
    LogseqReversibleCommandCodec,
    type SerializedLogseqReversibleCommand
} from "./commands";

export class LogseqReversibleTransactionCommandSerializer {
    public static serialize(command: LogseqReversibleCommand): SerializedLogseqReversibleCommand {
        return z.encode(LogseqReversibleCommandCodec, command);
    }

    public static deserialize(json: unknown): LogseqReversibleCommand {
        return z.decode(LogseqReversibleCommandCodec, json as SerializedLogseqReversibleCommand);
    }
}
