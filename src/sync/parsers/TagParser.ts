import { Note } from "../../anki-notes/Note";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import { getCaseInsensitive } from "../../utils/utils";
import _ from "lodash";

export class TagParser {
    static async parse(note: Note, initialTags: string[]): Promise<string[]> {
        let tags = [...initialTags];

        tags = await this.collectTagsFromBlockHierarchy(note, tags);
        tags = await this.collectTagsFromNamespaceHierarchy(note, tags);
        tags = this.normalizeTags(tags);
        tags = this.deduplicateTags(tags);
        tags = this.removeRedundantTags(tags);

        return tags;
    }

    private static async collectTagsFromBlockHierarchy(note: Note, tags: string[]): Promise<string[]> {
        try {
            let parentBlockUUID: string | number = note.uuid;
            while (parentBlockUUID != null) {
                const parentBlock = await LogseqProxy.Editor.getBlock(parentBlockUUID);
                const blockTags = getCaseInsensitive(parentBlock, "properties.tags", []);
                tags = [...tags, ...blockTags];
                parentBlockUUID = _.get(parentBlock, "parent.id", null);
            }
        } catch (e) {
            console.error("[TagParser] Error collecting tags from block hierarchy:", e);
        }
        return tags;
    }

    private static async collectTagsFromNamespaceHierarchy(note: Note, tags: string[]): Promise<string[]> {
        try {
            const parents = await LogseqProxy.Editor.getParentNamespacePages(note.page);
            const hierarchy = [note.page, ...parents];
            for (const page of hierarchy) {
                const pageTags = getCaseInsensitive(page, "properties.tags", []);
                tags = [...tags, ...pageTags];
            }
        } catch (e) {
            console.error("[TagParser] Error collecting tags from namespace hierarchy:", e);
        }
        return tags;
    }

    private static normalizeTags(tags: string[]): string[] {
        return tags
            .map((tag) => tag.replace(/\//g, "::"))
            .map((tag) => tag.replace(/\s/g, "_"));
    }

    private static deduplicateTags(tags: string[]): string[] {
        return _.uniq(tags);
    }

    private static removeRedundantTags(tags: string[]): string[] {
        return tags.filter((tag) => {
            const otherTags = tags.filter((otherTag) => otherTag !== tag);
            const redundantTags = otherTags.filter((otherTag) =>
                otherTag.startsWith(tag + "::")
            );
            return redundantTags.length === 0;
        });
    }
}
