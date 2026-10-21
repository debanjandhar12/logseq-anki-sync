import type {PluginSettings} from "../../../../src/settings";

export const MOCK_LOGSEQ_SETTINGS: PluginSettings = {
    disabled: false,
    breadcrumbDisplayOptions: ["Page name"],
    includeParentContent: true,
    standalonePageDeckBehavior: "Define in settings",
    standalonePageDeckName: "Default",
    renderClozeMarcosInLogseq: false,
    hideClozeMarcosUntilHoverInLogseq: false,
    addonsList: [],
    ankiFieldOptions: [],
    syncOverwriteList: ["Template", "Content", "Deck", "Tags", "Suspended"],
    inheritPropertiesFromTags: false,
    enableExperimentalWebSync: false,
    debug: []
};

let defaultSettings: PluginSettings = MOCK_LOGSEQ_SETTINGS;

export function setDefaultSettings(settings: Partial<PluginSettings>): void {
    defaultSettings = {...MOCK_LOGSEQ_SETTINGS, ...settings};
}

export function getDefaultSettings(): PluginSettings {
    return {...defaultSettings};
}
