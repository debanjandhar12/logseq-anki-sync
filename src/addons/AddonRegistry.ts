import type {Addon} from "./Addon";
import {HideOcclusionData} from "./HideOcclusionData";
import {PreviewInAnkiContextMenu} from "./PreviewInAnki";
// import {AnkiFeatureExplorer} from "./LogseqAnkiFeatureExplorer";

/**
 * Global registry of addons for Logseq Anki Sync plugin.
 */
export class AddonRegistry {
    public static addonsList: Addon[] = [];
    public static add(addon: Addon) {
        AddonRegistry.addonsList.push(addon);
    }
    public static get(name: string): Addon {
        return AddonRegistry.addonsList.find((addon) => addon.getName() === name);
    }
    public static getAll(): Addon[] {
        return AddonRegistry.addonsList;
    }
}

AddonRegistry.add(PreviewInAnkiContextMenu.getInstance());
AddonRegistry.add(HideOcclusionData.getInstance());
// AddonRegistry.add(AnkiFeatureExplorer.getInstance());
