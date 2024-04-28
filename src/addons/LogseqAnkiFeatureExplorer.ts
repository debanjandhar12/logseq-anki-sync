import { Addon } from "./Addon";
import { LogseqAnkiFeatureExplorer } from "../ui/customized/LogseqAnkiFeatureExplorer";

export class AnkiFeatureExplorer extends Addon {
    static _instance: AnkiFeatureExplorer;

    public getName(): string {
        return "Anki Feature Explorer Context Menu";
    }

    public init(): void {
        if (this.isEnabled()) {
            logseq.Editor.registerBlockContextMenuItem(
                "Anki Feature Explorer",
                this.openAnkiFeatureExplorer,
            );
            logseq.Editor.registerSlashCommand("Open Anki Feature Explorer", this.openAnkiFeatureExplorer);
            logseq.App.registerPageMenuItem("Anki Feature Explorer", async (page) => {
                const blocks = await logseq.Editor.getPageBlocksTree(page.page);
                await this.openAnkiFeatureExplorer(...blocks);
            });
        }
    }

    private async openAnkiFeatureExplorer(...blocks) {
        try {
            await LogseqAnkiFeatureExplorer(blocks[0].uuid);
        } catch (e) {
            console.error(e);
        }
    }

    public static getInstance(): Addon {
        if (!AnkiFeatureExplorer._instance)
            AnkiFeatureExplorer._instance = new AnkiFeatureExplorer();
        return AnkiFeatureExplorer._instance;
    }
}