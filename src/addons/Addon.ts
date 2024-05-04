export abstract class Addon {
    public abstract getName(): string;
    public abstract init(): void;
    public remove(): void {
        console.log("Reloading Logseq Anki Sync plugin...");
        window.parent.LSPluginCore.reload([logseq.baseInfo.id]);
    }
    public isEnabled(): boolean {
        const addonsList = logseq.settings.addonsList || [];
        return addonsList.includes(this.getName());
    }
}
