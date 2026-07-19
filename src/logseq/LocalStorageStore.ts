import type {IAsyncStorage} from "@logseq/libs/dist/modules/LSPlugin.Storage";

export class LocalStorageStore implements IAsyncStorage {
    private readonly keyPrefix: string;

    constructor(namespace: string) {
        this.keyPrefix = `logseq-plugin-storage:${namespace}:`;
    }

    async getItem(key: string): Promise<string | undefined> {
        return localStorage.getItem(this.getStorageKey(key)) ?? undefined;
    }

    async setItem(key: string, value: string): Promise<void> {
        localStorage.setItem(this.getStorageKey(key), value);
    }

    async removeItem(key: string): Promise<void> {
        localStorage.removeItem(this.getStorageKey(key));
    }

    async hasItem(key: string): Promise<boolean> {
        return localStorage.getItem(this.getStorageKey(key)) !== null;
    }

    async allKeys(): Promise<Array<string>> {
        const keys: Array<string> = [];

        for (let index = 0; index < localStorage.length; index += 1) {
            const storageKey = localStorage.key(index);
            if (storageKey?.startsWith(this.keyPrefix)) {
                keys.push(storageKey.slice(this.keyPrefix.length));
            }
        }

        return keys;
    }

    async clear(): Promise<void> {
        const keys = await this.allKeys();

        for (const key of keys) {
            localStorage.removeItem(this.getStorageKey(key));
        }
    }

    private getStorageKey(key: string): string {
        return `${this.keyPrefix}${key}`;
    }
}
