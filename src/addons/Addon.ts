export abstract class Addon {
    public abstract getName(): string;
    public abstract init(): void;
    public remove(): void {};
    public isEnabled(): boolean {
        return logseq.settings.addons.includes(this.getName());
    }
}