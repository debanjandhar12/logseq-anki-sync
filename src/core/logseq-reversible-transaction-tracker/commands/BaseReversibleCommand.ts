import type {PageIdentity} from "@logseq/libs/dist/LSPlugin";
import type {DeterministicUUIDGenerator} from "../DeterministicUUIDGenerator";
import type {LogseqReversibleTransactionResult} from "../types";

export abstract class BaseReversibleCommand {
    protected changedPages: PageIdentity[] = [];

    public abstract execute(
        deterministicUUIDGenerator: DeterministicUUIDGenerator
    ): Promise<LogseqReversibleTransactionResult>;

    public abstract revert(): Promise<void>;

    public getChangedPages(): PageIdentity[] {
        return [...this.changedPages];
    }
}
