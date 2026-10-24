import "@logseq/libs";

import {createLogger, LoggerCategory} from "../logger";
import {LogseqProxy} from "../logseq/LogseqProxy";
import {WindowParentBridge} from "../logseq/WindowParentBridge";

const logger = createLogger(LoggerCategory.Others);

/**
 * This is base class for all addons of Logseq Anki Sync Plugin.
 * Addons can be enabled from plugin settings.
 */
export abstract class Addon {
    public abstract getName(): string;
    public abstract init(): void;
    public remove(): void {
        logger.info("Reloading Logseq Anki Sync plugin...");
        WindowParentBridge.reloadPlugin(logseq.baseInfo.id);
    }

    /**
     * Whether the addon is enabled in settings.
     */
    public isEnabled(): boolean {
        const {addonsList} = LogseqProxy.Settings.getPluginSettings();
        return addonsList?.includes(this.getName()) ?? false;
    }

    /**
     * Whether the addon can be used in the current graph.
     * When false, the addon is not listed in settings.
     */
    public isSupported(_isDbGraph: boolean): boolean {
        return true;
    }
}
