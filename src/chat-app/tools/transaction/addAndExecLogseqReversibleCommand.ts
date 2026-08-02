import type {ThreadMessage} from "@assistant-ui/react";
import type {
    BaseReversibleCommand,
    LogseqReversibleTransactionResult
} from "src/core/logseq-reversible-transaction-tracker";
import {getLastLogseqReversibleTransactionTracker} from "./getLastLogseqReversibleTransactionTracker";

export async function addAndExecLogseqReversibleCommand<
    Result extends LogseqReversibleTransactionResult
>(options: {
    command: BaseReversibleCommand<any>;
    messages?: readonly ThreadMessage[];
    signal?: AbortSignal;
}): Promise<{
    result: Result;
    tracker: ReturnType<typeof getLastLogseqReversibleTransactionTracker>;
}> {
    options.signal?.throwIfAborted();
    if (!options.command.doesGraphMutations()) {
        throw new Error("Non-mutating commands must be executed outside the transaction tracker");
    }
    const tracker = getLastLogseqReversibleTransactionTracker(options.messages);
    tracker.addCommand(options.command);
    const result = (await tracker.execute({signal: options.signal})) as Result;
    return {result, tracker};
}
