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

export const TextSearchCommandStateSchema = z.object({
    status: z.enum(["new", "executed"])
});
export type TextSearchCommandState = z.output<typeof TextSearchCommandStateSchema>;

/**
 * Searches Logseq for pages and blocks matching a text string.
 *
 * Serialized data:
 * - args
 *
 * Runtime-only data:
 * - none
 */
export class TextSearchCommand extends BaseReversibleCommand<TextSearchCommandState> {
    public readonly args: TextSearchCommandArgs;

    public constructor(args: TextSearchCommandArgsInput, commandState?: TextSearchCommandState) {
        super(TextSearchCommandStateSchema.parse(commandState ?? {status: "new"}));
        this.args = TextSearchCommandArgsSchema.parse(args);
    }

    public async execute(): Promise<any> {
        this.assertCanExecute();
        if (!LogseqAppInfoFetcher.checkHostAccess()) {
            throw new Error(
                "Window.parent access is required to call logseq.api.search. Plugin API does not have this method."
            );
        }

        const result = await (WindowParentBridge.getLogseqObject() as any).api.search(
            this.args.searchString
        );
        this.commandState.status = "executed";
        return result;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        this.commandState.status = "new";
    }
}

export const TextSearchCommandCodec = createReversibleCommandCodec({
    type: "TextSearch",
    argsSchema: TextSearchCommandArgsSchema,
    commandStateSchema: TextSearchCommandStateSchema,
    commandClass: TextSearchCommand
});
