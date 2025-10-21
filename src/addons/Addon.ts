import '@logseq/libs';
import { LogseqProxy } from '../logseq/LogseqProxy';

export abstract class Addon {
    public abstract getName(): string;
    public abstract init(): void;
    public remove(): void {
        console.log("Reloading Logseq Anki Sync plugin...");
        window.parent.LSPluginCore.reload([logseq.baseInfo.id]);
    }
    public isEnabled(): boolean {
        const { addonsList } = LogseqProxy.Settings.getPluginSettings();
        return addonsList?.includes(this.getName()) ?? false;
    }
}
