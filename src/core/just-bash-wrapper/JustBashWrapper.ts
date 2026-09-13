import {Bash} from "just-bash";
import {JustBashAdapterFS} from "./JustBashAdapterFS";
import {createAllowlistedFetch} from "./network";
import {python3Command, pythonCommand} from "./pyodide";
import {JUST_BASH_USER_HOME} from "./types";
import {SessionFileSystem} from "./zenfs/sessionFs";
import {ZenFsAdapter} from "./zenfs/ZenFsAdapter";

/** Singleton accessor for the shared, fully virtual just-bash sandbox. */
export class JustBashWrapper {
    private static instance: Bash | null = null;
    private static instancePromise: Promise<Bash> | null = null;

    /** Initialize the session filesystem (Logseq mounts are async) and the shell. */
    static async ensureInstance(): Promise<Bash> {
        if (JustBashWrapper.instance) return JustBashWrapper.instance;
        JustBashWrapper.instancePromise ??= (async () => {
            await SessionFileSystem.init();
            const bash = new Bash({
                fs: new ZenFsAdapter(),
                cwd: JUST_BASH_USER_HOME,
                fetch: createAllowlistedFetch(globalThis.fetch.bind(globalThis)),
                customCommands: [pythonCommand, python3Command],
                python: false, // python provided using pyodide through pythonCommand
                javascript: false
            });
            JustBashWrapper.instance = bash;
            return bash;
        })();
        return JustBashWrapper.instancePromise;
    }

    /** Sync access for callers that already awaited {@link ensureInstance}. */
    static getInstance(): Bash {
        if (JustBashWrapper.instance == null) {
            throw new Error("JustBashWrapper is not initialized: await ensureInstance() first");
        }
        return JustBashWrapper.instance;
    }

    /** Drop the shared instance so tests can rebuild it with fresh mounts and storage. */
    static resetInstanceForTesting(): void {
        JustBashWrapper.instance = null;
        JustBashWrapper.instancePromise = null;
        SessionFileSystem.resetForTesting();
    }
}
