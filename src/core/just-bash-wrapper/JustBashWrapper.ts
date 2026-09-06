import {Bash, InMemoryFs, MountableFs} from "just-bash";
import {LogseqHttpProxy} from "src/logseq/LogseqHttpProxy";
import {JustBashAdapterFS} from "./JustBashAdapterFS";
import {createAllowlistedFetch} from "./network";
import {qjsCommand} from "./qjs";
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
                // The Logseq proxy cannot expose redirect hops, so sandbox requests use the
                // browser transport where every redirect can be checked against the allowlist.
                fetch: createAllowlistedFetch(LogseqHttpProxy.getNativeFetch()),
                customCommands: [qjsCommand],
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
