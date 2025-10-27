import { Note } from "../../anki-notes/Note";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import { ANKI_CLOZE_REGEXP, MD_PROPERTIES_REGEXP } from "../../constants";
import { BlockEntity } from "@logseq/libs/dist/LSPlugin";

export class BreadcrumbAndParentBlockParser {
    static async parse(note: Note, graphName: string): Promise<string> {
        const { breadcrumbDisplay } = LogseqProxy.Settings.getPluginSettings();
        
        if (!breadcrumbDisplay.includes("Show Page name")) {
            return this.buildHiddenBreadcrumb(note, graphName);
        }

        if (breadcrumbDisplay === "Show Page name and parent blocks context") {
            return await this.buildFullBreadcrumb(note, graphName);
        }

        return this.buildPageOnlyBreadcrumb(note, graphName);
    }

    private static buildHiddenBreadcrumb(note: Note, graphName: string): string {
        return `<a href="logseq://graph/${encodeURIComponent(graphName)}?page=${encodeURIComponent(
            note.page.originalName
        )}" class="hidden">${note.page.originalName}</a>`;
    }

    private static buildPageOnlyBreadcrumb(note: Note, graphName: string): string {
        return `<a href="logseq://graph/${encodeURIComponent(graphName)}?page=${encodeURIComponent(
            note.page.originalName
        )}" title="${note.page.originalName}">${note.page.originalName}</a>`;
    }

    private static async buildFullBreadcrumb(note: Note, graphName: string): Promise<string> {
        let breadcrumb = this.buildPageOnlyBreadcrumb(note, graphName);
        
        try {
            const parentBlocks = await this.collectParentBlocks(note);
            for (const parentBlock of parentBlocks) {
                const firstLine = parentBlock.content.split("\n")[0];
                breadcrumb += ` > <a href="logseq://graph/${encodeURIComponent(
                    graphName
                )}?block-id=${encodeURIComponent(parentBlock.uuid)}" title="${
                    parentBlock.content
                }">${firstLine}</a>`;
            }
        } catch (e) {
            console.error("[BreadcrumbAndParentBlockParser] Error building full breadcrumb:", e);
        }

        return breadcrumb;
    }

    private static async collectParentBlocks(note: Note): Promise<Array<{content: string, uuid: string}>> {
        const parentBlocks = [];
        let parentID = (await LogseqProxy.Editor.getBlock(note.uuid)).parent.id;
        let parentBlock: BlockEntity;

        while ((parentBlock = await LogseqProxy.Editor.getBlock(parentID)) != null) {
            parentBlocks.push({
                content: parentBlock.content
                    .replaceAll(MD_PROPERTIES_REGEXP, "")
                    .replaceAll(ANKI_CLOZE_REGEXP, "$3"),
                uuid: parentBlock.uuid,
            });
            parentID = parentBlock.parent.id;
        }

        return parentBlocks.reverse();
    }
}
