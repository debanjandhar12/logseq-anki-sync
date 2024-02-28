export abstract class Addon {
    public abstract getName(): string;
    public abstract init(): void;
    public remove(): void {
        console.log("Reloading Logseq Anki Sync plugin...");
        window.parent.LSPluginCore.reload([logseq.baseInfo.id]);
    }
    public isEnabled(): boolean {
        const addons = logseq.settings.addons || [];
        return addons.includes(this.getName());
    }
}
