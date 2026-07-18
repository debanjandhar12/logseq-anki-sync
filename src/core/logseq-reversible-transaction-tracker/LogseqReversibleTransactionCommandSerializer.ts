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
        return z.decode(
            LogseqReversibleCommandCodec,
            migrateLegacyCommand(json) as SerializedLogseqReversibleCommand
        );
    }
}

export function migrateLegacyCommand(json: unknown): unknown {
    if (typeof json !== "object" || json === null || !("type" in json)) return json;
    if ("args" in json && "commandState" in json) return json;

    const {type, ...legacyData} = json as Record<string, unknown>;
    const args = {...legacyData};
    const commandState: Record<string, unknown> = {status: "new"};
    if (type === "CreatePage" && "pageUuid" in args) {
        commandState.pageUuid = args.pageUuid;
        delete args.pageUuid;
    }
    if (type === "InsertBlock" && "blockUuid" in args) {
        commandState.blockUuid = args.blockUuid;
        delete args.blockUuid;
    }
    if (type === "CreateTagPage" && "tagPageUuid" in args) {
        commandState.tagPageUuid = args.tagPageUuid;
        delete args.tagPageUuid;
    }

    return {type, args, commandState};
}
