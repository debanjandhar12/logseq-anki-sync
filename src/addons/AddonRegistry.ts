import {Addon} from "./Addon";
import {PreviewInAnkiContextMenu} from "./PreviewInAnki";
import {HideOcclusionData} from "./HideOcclusionData";
import {AnkiFeatureExplorer} from "./LogseqAnkiFeatureExplorer";

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
AddonRegistry.add(AnkiFeatureExplorer.getInstance());