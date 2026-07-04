import {LogseqAppInfoFetcher} from "src/logseq/LogseqAppInfoFetcher";
import {WindowParentBridge} from "src/logseq/WindowParentBridge";
import {z} from "zod";
import {BaseReversibleCommand} from "./BaseReversibleCommand";
import {createReversibleCommandCodec} from "./createReversibleCommandCodec";

export const TextSearchCommandArgsSchema = z.object({
    searchString: z.string().describe("Text to search for in Logseq.")
});

export type TextSearchCommandArgsInput = z.input<typeof TextSearchCommandArgsSchema>;
export type TextSearchCommandArgs = z.output<typeof TextSearchCommandArgsSchema>;

const TextSearchCommandSerializedSchema = TextSearchCommandArgsSchema.extend({
    type: z.literal("TextSearch")
});

/**
 * Searches Logseq for pages and blocks matching a text string.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - none
 */
export class TextSearchCommand extends BaseReversibleCommand {
    public readonly args: TextSearchCommandArgs;

    public constructor(args: TextSearchCommandArgsInput) {
        super();
        this.args = TextSearchCommandArgsSchema.parse(args);
    }

    public async execute(): Promise<any> {
        if (!LogseqAppInfoFetcher.checkHostAccess()) {
            throw new Error(
                "Window.parent access is required to call logseq.api.search. Plugin API does not have this method."
            );
        }

        return await (WindowParentBridge.getLogseqObject() as any).api.search(
            this.args.searchString
        );
    }

    public async revert(): Promise<void> {}
}

export const TextSearchCommandCodec = createReversibleCommandCodec({
    type: "TextSearch",
    serializedSchema: TextSearchCommandSerializedSchema,
    commandSchema: z.instanceof(TextSearchCommand),
    decode: (args) => new TextSearchCommand(args),
    encodeData: (command) => command.args
});
