import {LogseqFakeableTransactionTracker} from "src/core/logseq-fakeable-transaction-tracker";

export const getLastLogseqFakeableTransactionTracker = () => {
    return new LogseqFakeableTransactionTracker();
}