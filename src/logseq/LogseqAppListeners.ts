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
    static registerGraphChangeListener(listener: (e: any) => void): () => void {
        LogseqAppListeners.registeredGraphChangeListeners.push(listener);
        return () => {
            const idx = LogseqAppListeners.registeredGraphChangeListeners.indexOf(listener);
            if (idx >= 0) LogseqAppListeners.registeredGraphChangeListeners.splice(idx, 1);
        };
    }

    static registeredPluginUnloadListeners: Array<() => void> = [];
    static registerPluginUnloadListener(listener: () => void): () => void {
        LogseqAppListeners.registeredPluginUnloadListeners.push(listener);
        return () => {
            const idx = LogseqAppListeners.registeredPluginUnloadListeners.indexOf(listener);
            if (idx >= 0) LogseqAppListeners.registeredPluginUnloadListeners.splice(idx, 1);
        };
    }
}
