import {Bash, InMemoryFs, MountableFs} from "just-bash";
import {
    VIR_ENV_GID,
    VIR_ENV_HOSTNAME,
    VIR_ENV_UID,
    VIR_ENV_USER,
    VIR_ENV_USER_PATH
} from "../../constants";
import {virtualIdentityCommands} from "./commands";
import {PythonCommandFactory} from "./commands/createPythonCommands";
import {JustBashAdapterFS} from "./JustBashAdapterFS";
import {createSecureFetch} from "./network";
import type {CreateLogseqBridge} from "./pyodide/logseq-lib/types";
import {ReadOnlyFileSystem} from "./ReadOnlyFileSystem";

/** Singleton accessor for the shared, fully virtual just-bash sandbox. */
export class JustBashWrapper {
    private static instance: Promise<Bash> | null = null;
    private static adapters: JustBashAdapterFS[] = [];

    public static async createExecutionInstance(createLogseqBridge: CreateLogseqBridge): Promise<Bash> {
        const shared = await JustBashWrapper.getInstance();
        return JustBashWrapper.createBash(
            new ReadOnlyFileSystem(shared.fs),
            new PythonCommandFactory({createLogseqBridge})
        );
    }

    static async getInstance(): Promise<Bash> {
        if (JustBashWrapper.instance == null) {
            JustBashWrapper.instance = JustBashWrapper.createInstance().catch((error) => {
                JustBashWrapper.instance = null;
                JustBashWrapper.adapters = [];
                throw error;
            });
            return JustBashWrapper.instance;
        }
        const instance = await JustBashWrapper.instance;
        await Promise.all(JustBashWrapper.adapters.map((adapter) => adapter.refresh()));
        return instance;
    }

    private static async createInstance(): Promise<Bash> {
        const baseFileSystem = new InMemoryFs();
        baseFileSystem.mkdirSync(VIR_ENV_USER_PATH, {recursive: true});
        baseFileSystem.mkdirSync("/tmp", {recursive: true});

        const mounts = JustBashAdapterFS.getMountConfigs();
        JustBashWrapper.adapters = mounts.map(({filesystem}) => filesystem);
        await Promise.all(JustBashWrapper.adapters.map((adapter) => adapter.refresh()));
        return JustBashWrapper.createBash(
            new MountableFs({
                base: new ReadOnlyFileSystem(baseFileSystem),
                mounts
            })
        );
    }

    private static createBash(fs: Bash["fs"], pythonCommands = new PythonCommandFactory()): Bash {
        return new Bash({
            fs,
            cwd: VIR_ENV_USER_PATH,
            env: {
                HOME: VIR_ENV_USER_PATH,
                USER: VIR_ENV_USER,
                LOGNAME: VIR_ENV_USER,
                HOSTNAME: VIR_ENV_HOSTNAME
            },
            processInfo: {uid: VIR_ENV_UID, gid: VIR_ENV_GID},
            fetch: createSecureFetch(globalThis.fetch.bind(globalThis)),
            customCommands: [
                ...pythonCommands.create("python", "python3", "py"),
                ...virtualIdentityCommands
            ],
            python: false, // Python is provided by the custom Pyodide commands. We cannot use just-bash's inbuilt python environment in-browser.
            javascript: false
        });
    }

    /** Drop the shared instance so tests can rebuild it with fresh mounts and storage. */
    static resetInstanceForTesting(): void {
        JustBashWrapper.instance = null;
        JustBashWrapper.adapters = [];
    }
}
