export class LogseqAppListeners {
    static init() {
        logseq.App.onCurrentGraphChanged((e) => {
            for (const listener of LogseqAppListeners.registeredGraphChangeListeners) {
                listener(e);
            }
        });
        logseq.beforeunload(async () => {
            for (const listener of LogseqAppListeners.registeredPluginUnloadListeners) {
                listener();
            }
        });
    }

    static registeredGraphChangeListeners: Array<(e: any) => void> = [];
    static registerGraphChangeListener(listener: (e: any) => void): void {
        LogseqAppListeners.registeredGraphChangeListeners.push(listener);
    }

    static registeredPluginUnloadListeners: Array<() => void> = [];
    static registerPluginUnloadListener(listener: () => void): void {
        LogseqAppListeners.registeredPluginUnloadListeners.push(listener);
    }
}
