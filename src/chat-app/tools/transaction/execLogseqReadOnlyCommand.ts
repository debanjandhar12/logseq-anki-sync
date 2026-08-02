import type {
    BaseReversibleCommand,
    LogseqReversibleTransactionResult
} from "src/core/logseq-reversible-transaction-tracker";
import {LogseqReversibleTransactionOperationLockManager} from "src/core/logseq-reversible-transaction-tracker";

export async function execLogseqReadOnlyCommand<Result extends LogseqReversibleTransactionResult>(
    command: BaseReversibleCommand<any>,
    options?: {signal?: AbortSignal}
): Promise<Result> {
    if (command.doesGraphMutations()) {
        throw new Error("Graph-mutating commands must be executed through the transaction tracker");
    }

    return await LogseqReversibleTransactionOperationLockManager.runExclusive(async () => {
        options?.signal?.throwIfAborted();
        command.resetChangedPages();
        return (await command.execute()) as Result;
    });
}
