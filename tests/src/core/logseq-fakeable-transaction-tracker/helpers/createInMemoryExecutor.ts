import {
    DeterminesticUUIDGenerator,
    InMemoryExecutor,
    type InMemoryPageLoader
} from "../../../../../src/core/logseq-fakeable-transaction-tracker";
import {NullPageLoader} from "./NullPageLoader";

const UUID_SEED = "5f9c57d6-3466-4ba3-b6bf-01e12f11c91d";

export function createInMemoryExecutor(pageLoader?: InMemoryPageLoader): InMemoryExecutor {
    return new InMemoryExecutor(
        new DeterminesticUUIDGenerator(UUID_SEED),
        pageLoader ?? new NullPageLoader()
    );
}

export function generateIdentities(count: number): string[] {
    const generator = new DeterminesticUUIDGenerator(UUID_SEED);
    return Array.from({length: count}, () => generator.getUUID());
}

