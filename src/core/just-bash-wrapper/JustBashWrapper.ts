import {Bash, InMemoryFs, MountableFs} from "just-bash";
import {JustBashAdapterFS} from "./JustBashAdapterFS";
import {ReadOnlyFileSystem} from "./ReadOnlyFileSystem";
import {JUST_BASH_USER_HOME} from "./types";

/** Singleton accessor for the shared, fully virtual just-bash sandbox. */
export class JustBashWrapper {
    private static instance: Bash | null = null;

    static getInstance(): Bash {
        if (JustBashWrapper.instance == null) {
            const baseFileSystem = new InMemoryFs();
            baseFileSystem.mkdirSync(JUST_BASH_USER_HOME, {recursive: true});
            baseFileSystem.mkdirSync("/tmp", {recursive: true});

            JustBashWrapper.instance = new Bash({
                fs: new MountableFs({
                    base: new ReadOnlyFileSystem(baseFileSystem),
                    mounts: JustBashAdapterFS.getMountConfigs()
                }),
                cwd: JUST_BASH_USER_HOME,
                python: false,
                javascript: false
            });
        }
        return JustBashWrapper.instance;
    }

    /** Drop the shared instance so tests can rebuild it with fresh mounts and storage. */
    static resetInstanceForTesting(): void {
        JustBashWrapper.instance = null;
    }
}
