import type {IAsyncStorage} from "@logseq/libs/dist/modules/LSPlugin.Storage";

export class InMemoryStore implements IAsyncStorage {
    private static readonly namespaces = new Map<string, Map<string, string>>();

    private readonly values: Map<string, string>;

    constructor(namespace: string) {
        let values = InMemoryStore.namespaces.get(namespace);
        if (values == null) {
            values = new Map<string, string>();
            InMemoryStore.namespaces.set(namespace, values);
        }

        this.values = values;
    }

    static clearAll(): void {
        InMemoryStore.namespaces.clear();
    }

    async getItem(key: string): Promise<string | undefined> {
        return this.values.get(key);
    }

    async setItem(key: string, value: string): Promise<void> {
        this.values.set(key, value);
    }

    async removeItem(key: string): Promise<void> {
        this.values.delete(key);
    }

    async hasItem(key: string): Promise<boolean> {
        return this.values.has(key);
    }

    async allKeys(): Promise<Array<string>> {
        return Array.from(this.values.keys());
    }

    async clear(): Promise<void> {
        this.values.clear();
    }
}
