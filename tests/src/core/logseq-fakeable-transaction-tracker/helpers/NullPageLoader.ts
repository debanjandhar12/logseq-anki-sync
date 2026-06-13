import type {InMemoryPageLoader} from "../../../../../src/core/logseq-fakeable-transaction-tracker";

export class NullPageLoader implements InMemoryPageLoader {
    public async loadPageForIdentity() {
        return null;
    }
}