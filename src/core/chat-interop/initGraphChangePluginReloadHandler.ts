import {LogseqAppListeners} from "src/logseq/LogseqAppListeners";
import {WindowParentBridge} from "src/logseq/WindowParentBridge";

export function initGraphChangePluginReloadHandler(): void {
    LogseqAppListeners.registerGraphChangeListener(() => {
        setTimeout(() => {
            try {
                WindowParentBridge.reloadPlugin(logseq.baseInfo.id);
            } catch {
                // Reload is unavailable without host access.
            }
        }, 0);
    });
}
