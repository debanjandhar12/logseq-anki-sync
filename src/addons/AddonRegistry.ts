import {Addon} from "./Addon";
import {PreviewInAnkiContextMenu} from "./PreviewInAnki";
import {HideOcclusionData} from "./HideOcclusionData";

export class AddonRegistry {
    public static addons: Addon[] = [];
    public static add(addon: Addon) {
        AddonRegistry.addons.push(addon);
    }
    public static get(name: string): Addon {
        return AddonRegistry.addons.find((addon) => addon.getName() === name);
    }
    public static getAll(): Addon[] {
        return AddonRegistry.addons;
    }
}

AddonRegistry.add(PreviewInAnkiContextMenu.getInstance());
AddonRegistry.add(HideOcclusionData.getInstance());
