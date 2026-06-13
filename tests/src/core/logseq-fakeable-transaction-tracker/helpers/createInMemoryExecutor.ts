import {
    DeterminesticUUIDGenerator,
    InMemoryExecutor,
    type InMemoryPageLoader,
    type InMemorySchemaPageLoader
} from "../../../../../src/core/logseq-fakeable-transaction-tracker";
import {NullPageLoader} from "./NullPageLoader";

const UUID_SEED = "5f9c57d6-3466-4ba3-b6bf-01e12f11c91d";

export function createInMemoryExecutor(
    pageLoader?: InMemoryPageLoader,
    schemaPageLoader: InMemorySchemaPageLoader = new NullSchemaPageLoader()
): InMemoryExecutor {
    return new InMemoryExecutor(
        new DeterminesticUUIDGenerator(UUID_SEED),
        pageLoader ?? new NullPageLoader(),
        schemaPageLoader
    );
}

export function generateIdentities(count: number): string[] {
    const generator = new DeterminesticUUIDGenerator(UUID_SEED);
    return Array.from({length: count}, () => generator.getUUID());
}

class NullSchemaPageLoader implements InMemorySchemaPageLoader {
    async loadPropertyPage() {
        return null;
    }

    async loadTagPage() {
        return null;
    }
}
