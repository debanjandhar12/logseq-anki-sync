export abstract class Addon {
    public abstract getName(): string;
    public abstract init(): void;
    public remove(): void {}
    public isEnabled(): boolean {
        const addons = logseq.settings.addons || [];
        return addons.includes(this.getName());
    }
}
