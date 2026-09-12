import {configure, CopyOnWriteFS, fs, InMemory, Readonly, StoreFS, InMemoryStore} from "@zenfs/core";
import {JustBashAdapterFS} from "../JustBashAdapterFS";
import {JUST_BASH_USER_HOME} from "../types";
import {createLogseqStorageFs} from "./LogseqStorageFs";

export interface SessionMount {
    folderName: string;
    permission: "read" | "readexecute" | "readwrite";
    mountPoint: string;
}

/**
 * The shared session filesystem: an in-memory writable root with each
 * registered Logseq plugin folder mounted copy-on-write. Bash and Python both
 * operate on this tree; changes accumulate in the copy-on-write layers and are
 * never flushed back to plugin storage.
 */
export class SessionFileSystem {
    private static instance: SessionFileSystem | null = null;
    private static initPromise: Promise<SessionFileSystem> | null = null;

    private constructor(readonly mounts: readonly SessionMount[]) {}

    static async init(): Promise<SessionFileSystem> {
        if (this.instance) return this.instance;
        this.initPromise ??= (async () => {
            const mounts = await this.buildMounts();
            await configure({mounts: {"/": InMemory, ...mounts}});
            await fs.promises.mkdir(JUST_BASH_USER_HOME, {recursive: true});
            await fs.promises.mkdir("/tmp", {recursive: true});
            this.instance = new SessionFileSystem(mounts);
            return this.instance;
        })();
        return this.initPromise;
    }

    static getInstance(): SessionFileSystem | null {
        return this.instance;
    }

    static resetForTesting(): void {
        this.instance = null;
        this.initPromise = null;
        void configure({mounts: {"/": InMemory}});
    }

    private static async buildMounts(): Promise<Record<string, CopyOnWriteFS>> {
        const mounts: Record<string, CopyOnWriteFS> = {};
        for (const {folderName, permission} of JustBashAdapterFS.getMountDescriptors()) {
            const readable = await createLogseqStorageFs(folderName, permission);
            const writable = new StoreFS(new InMemoryStore());
            const mountPoint = `${JUST_BASH_USER_HOME}/${folderName}`;
            mounts[mountPoint] =
                permission === "readwrite"
                    ? new CopyOnWriteFS(readable, writable)
                    : new (Readonly(CopyOnWriteFS))(readable, writable);
        }
        return mounts;
    }
}
