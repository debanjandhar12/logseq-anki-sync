import {Note} from "./Note";
import "@logseq/libs";
import _ from "lodash";
import {convertToHTMLFile, HTMLFile} from "../converter/Converter";
import {escapeClozeAndSecoundBrace, safeReplace} from "../utils/utils";
import {ANKI_CLOZE_REGEXP, MD_PROPERTIES_REGEXP} from "../constants";
import {LogseqProxy} from "../logseq/LogseqProxy";
import {BlockUUID} from "@logseq/libs/dist/LSPlugin.user";
import {DependencyEntity} from "../converter/getContentDirectDependencies";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";
import {NoteUtils} from "./NoteUtils";

export class MultilineCardNote extends Note {
    public type = "multiline_card";
    public children: any[];
    public tags: any[];
    public constructor(
        uuid: string,
        content: string,
        format: string,
        properties: any,
        page: any,
        tags: any = [],
        children: any = [],
        tagIds: number[] = [],
    ) {
        super(uuid, content, format, properties, page, tagIds);
        this.children = children;
        this.tags = tags;
    }

    public static initLogseqOperations = () => {
        // Init logseq operations at start of the program
        logseq.Editor.registerSlashCommand("Card (Forward)", [
            ["editor/input", `#card #forward`],
            ["editor/clear-current-slash"],
        ]);
        logseq.Editor.registerSlashCommand("Card (Reversed)", [
            ["editor/input", `#card #reversed`],
            ["editor/clear-current-slash"],
        ]);
        logseq.Editor.registerSlashCommand("Card (Bidirectional)", [
            ["editor/input", `#card #bidirectional`],
            ["editor/clear-current-slash"],
        ]);
        logseq.Editor.registerSlashCommand("Card (Incremental)", [
            ["editor/input", `#card #incremental`],
            ["editor/clear-current-slash"],
        ]);
        logseq.provideStyle(`
            .page-reference[data-ref=flashcard], a[data-ref=flashcard] {
                opacity: .3;
            }
            .page-reference[data-ref=forward], a[data-ref=forward] {
                opacity: .3;
            }
            .page-reference[data-ref=reversed], a[data-ref=reversed] {
                opacity: .3;
            }
            .page-reference[data-ref=bidirectional], a[data-ref=bidirectional] {
                opacity: .3;
            }
            .page-reference[data-ref=incremental], a[data-ref=incremental] {
                opacity: .3;
            }
            .page-reference[data-ref^=depth-], a[data-ref^=depth-] {
                opacity: .3;
            }
            .page-reference[data-ref=flashcard], a[data-ref=card-group] {
                opacity: .3;
            }
        `);
        LogseqProxy.Editor.createPageSilentlyIfNotExists("card-group");
        LogseqProxy.Editor.createPageSilentlyIfNotExists("flashcard");
        LogseqProxy.Editor.createPageSilentlyIfNotExists("forward");
        LogseqProxy.Editor.createPageSilentlyIfNotExists("reversed");
        LogseqProxy.Editor.createPageSilentlyIfNotExists("bidirectional");
        LogseqProxy.Editor.createPageSilentlyIfNotExists("incremental");
    };

    private getCardDirection(): string {
        let direction = _.get(this, "properties.direction");
        if (direction != "->" && direction != "<-" && direction != "<->") {
            if (
                (this.tags.includes("reversed") && this.tags.includes("forward")) ||
                this.tags.includes("bidirectional")
            )
                direction = "<->";
            else if (this.tags.includes("reversed")) direction = "<-";
            else direction = "->";
        }
        return direction;
    }

    private getChildrenMaxDepth(): number {
        let maxDepth = _.get(this, "properties.depth") || 9999;
        for (const tag of this.tags) {
            const match = /^depth-(\d+)$/i.exec(tag);
            if (match) {
                maxDepth = parseInt(match[1]);
            }
        }
        return maxDepth;
    }

    private static async getRelevantTags(tagIds: any[]): Promise<string[]> {
        return await NoteUtils.matchTagNamesWithTagIds(tagIds, [
            "forward",
            "reversed",
            "bidirectional",
            "incremental",
            ...Array.from(Array(10).keys()).map((i) => `depth-${i}`),
        ]);
    }

    public async getClozedContentHTML(): Promise<HTMLFile> {
        let clozedContent = "";
        const clozedContentAssets: Set<string> = new Set();
        const direction = this.getCardDirection();

        // Remove clozes and double braces one after another.
        this.content = escapeClozeAndSecoundBrace(this.content);

        // Render the parent block and add to clozedContent
        const parentBlockHTMLFile = await convertToHTMLFile(this.content, this.format);
        parentBlockHTMLFile.assets.forEach((asset) => clozedContentAssets.add(asset));
        if (direction == "<->" || direction == "<-")
            // Insert cloze braces depending upon direction else simply add parent block html to clozedContent
            clozedContent = `{{c2::${parentBlockHTMLFile.html}}}`;
        else clozedContent = parentBlockHTMLFile.html;

        // Add the content of children blocks and cloze it if direction is <-> or ->
        let cloze_id = 1;
        const maxDepth = this.getChildrenMaxDepth();
        const getChildrenListHTMLFile = async (
            childrenList: any,
            level = 0,
        ): Promise<HTMLFile> => {
            if (level >= maxDepth) return {html: "", assets: new Set<string>(), tags: []};
            const childrenListAssets = new Set<string>();
            let childrenListHTML = `\n<ul class="children-list left-border">`;
            for (const child of childrenList) {
                childrenListHTML += `\n<li class="children">`;
                const childContent = _.get(child, "content", "");
                let sanitizedChildContent = escapeClozeAndSecoundBrace(childContent);
                const childExtra = _.get(child, "properties.extra");
                if (childExtra) {
                    sanitizedChildContent += `\n<div class="extra">${childExtra}</div>`;
                }
                const sanitizedChildHTMLFile = await convertToHTMLFile(
                    sanitizedChildContent,
                    child.format,
                );
                let sanitizedChildHTML = sanitizedChildHTMLFile.html;
                const sanitizedChildAssets = sanitizedChildHTMLFile.assets;
                sanitizedChildAssets.forEach((asset) => childrenListAssets.add(asset));
                if (child.children.length > 0) {
                    const allChildrenHTMLFile = await getChildrenListHTMLFile(
                        child.children,
                        level + 1,
                    );
                    sanitizedChildHTML += allChildrenHTMLFile.html;
                    allChildrenHTMLFile.assets.forEach((asset) =>
                        childrenListAssets.add(asset),
                    );
                }

                if (level == 0 && (direction == "<->" || direction == "->")) {
                    childrenListHTML += `{{c${cloze_id}:: ${sanitizedChildHTML} }}`;
                    if (this.tags.includes("incremental")) cloze_id++;
                    if (cloze_id == 2) cloze_id++;
                } else childrenListHTML += sanitizedChildHTML;
                childrenListHTML += `</li>`;
            }
            childrenListHTML += `</ul>`;
            return {
                html: childrenListHTML,
                assets: childrenListAssets,
                tags: [],
            };
        };
        const childrenHTMLFile = await getChildrenListHTMLFile(this.children);
        childrenHTMLFile.assets.forEach((asset) => clozedContentAssets.add(asset));
        clozedContent += childrenHTMLFile.html;

        if (this.children.length == 0 && (direction == "<->" || direction == "->"))
            clozedContent += `{{c${cloze_id}::}}`; // #16

        return {
            html: clozedContent,
            assets: clozedContentAssets,
            tags: parentBlockHTMLFile.tags,
        };
    }

    public static async getNotesFromLogseqBlocks(
        otherNotes: Array<Note>,
    ): Promise<MultilineCardNote[]> {
        const logseqCard_blocks = await LogseqProxy.DB.datascriptQueryBlocks(`
        [:find (pull ?b [*])
        :where
        [?p :block/name "card"]
        [?b :block/refs ?p]
        ]`);
        const flashCard_blocks = await LogseqProxy.DB.datascriptQueryBlocks(`
        [:find (pull ?b [*])
        :where
        [?p :block/name "flashcard"]
        [?b :block/refs ?p]
        ]`);
        let logseqCardGroup_blocks = await LogseqProxy.DB.datascriptQueryBlocks(`
        [:find (pull ?b [*])
        :where
        [?r :block/name "card-group"]
        [?p :block/refs ?r]
        [?b :block/parent ?p]
        ]`);
        logseqCardGroup_blocks = await Promise.all(
            logseqCardGroup_blocks.map(async (block) => {
                const uuid = getUUIDFromBlock(block[0]);
                const parent = block[0].parent.id;
                const parentBlock = await LogseqProxy.Editor.getBlock(parent);
                const tags = await MultilineCardNote.getRelevantTags(
                    _.get(parentBlock, "refs", []).map((ref) => ref.id),
                );
                block[0].tagsFromParentCardGroup = [...tags];
                return block;
            }),
        );
        let blocks: any = [
            ...logseqCard_blocks,
            ...flashCard_blocks,
            ...logseqCardGroup_blocks,
        ];
        let notes = await Promise.all(
            blocks.map(async (block) => {
                const uuid = getUUIDFromBlock(block[0]);
                const page = block[0].page
                    ? await LogseqProxy.Editor.getPage(block[0].page.id)
                    : {};
                const tagsFromParentCardGroup = _.get(block[0], "tagsFromParentCardGroup", []);
                block = await LogseqProxy.Editor.getBlock(uuid, {
                    includeChildren: true,
                });
                if (block) {
                    const tags = await MultilineCardNote.getRelevantTags(
                        _.get(block, "refs", []).map((ref) => ref.id),
                    );
                    return new MultilineCardNote(
                        uuid,
                        block.content,
                        block.format,
                        block.properties || {},
                        page,
                        // Apply tags in parent card group block - #168
                        tags && tags.length > 0 ? tags : tagsFromParentCardGroup,
                        block.children,
                        _.get(block, "refs", []).map((ref) => ref.id),
                    );
                } else {
                    return null;
                }
            }),
        );
        console.log("MultilineCardNote Loaded");
        notes = await Note.removeUnwantedNotes(notes);
        notes = _.filter(notes, (note) => {
            // Retain only blocks whose children count > 0 or direction is expictly specifed or no other note type is being generated from that block
            return (
                _.get(note, "properties.direction") ||
                note.tags.includes("forward") ||
                note.tags.includes("bidirectional") ||
                note.tags.includes("reversed") ||
                note.children.length > 0 ||
                !_.find(otherNotes, {uuid: note.uuid})
            );
        });
        return notes;
    }

    public getBlockDependencies(): DependencyEntity[] {
        function getChildrenUUID(children: any): BlockUUID[] {
            let result = [];
            for (const child of children) {
                result.push(child.uuid);
                result = result.concat(getChildrenUUID(child.children));
            }
            return result;
        }
        return [this.uuid, ...getChildrenUUID(this.children)].map(
            (block) => ({type: "Block", value: block}) as DependencyEntity,
        );
    }
}
