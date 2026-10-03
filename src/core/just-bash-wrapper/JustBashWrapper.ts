import {Bash, InMemoryFs, MountableFs} from "just-bash";
import {VIR_ENV_USER_PATH} from "../../constants";
import {JustBashAdapterFS} from "./JustBashAdapterFS";
import {createAllowlistedFetch} from "./network";
import {python3Command, pythonCommand} from "./pyodide";
import {ReadOnlyFileSystem} from "./ReadOnlyFileSystem";

/** Singleton accessor for the shared, fully virtual just-bash sandbox. */
export class JustBashWrapper {
    private static instance: Promise<Bash> | null = null;
    private static adapters: JustBashAdapterFS[] = [];

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
        return new Bash({
            fs: new MountableFs({
                base: new ReadOnlyFileSystem(baseFileSystem),
                mounts
            }),
            cwd: VIR_ENV_USER_PATH,
            fetch: createAllowlistedFetch(globalThis.fetch.bind(globalThis)),
            customCommands: [pythonCommand, python3Command],
            python: false, // python provided using pyodide through pythonCommand
            javascript: false
        });
    }

    /** Drop the shared instance so tests can rebuild it with fresh mounts and storage. */
    static resetInstanceForTesting(): void {
        JustBashWrapper.instance = null;
        JustBashWrapper.adapters = [];
    }
}
