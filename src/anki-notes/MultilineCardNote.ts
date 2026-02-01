import {Note} from "./Note";
import "@logseq/libs";
import _ from "lodash";
import {LogseqToHtmlConverterProxy, HTMLFile} from "../logseq/LogseqToHtmlConverter";
import {escapeClozesAndMacroDelimiters, safeReplace} from "../utils/utils";
import {LogseqProxy} from "../logseq/LogseqProxy";
import {BlockUUID} from "@logseq/libs/dist/LSPlugin.user";
import {DependencyEntity} from "../logseq/getLogseqContentDirectDependencies";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";
import { appendExtraToHtmlFile } from "./NoteUtils";

import { createLogger, LoggerCategory } from "../utils/logger";

const logger = createLogger(LoggerCategory.AnkiNotes);

export class MultilineCardNote extends Note {
    public type = "multiline_card";
    public children: any[];
    public constructor(
        uuid: string,
        content: string,
        format: string,
        properties: any,
        pageId: number,
        tags: string[] = [],
        children: any = [],
    ) {
        super(uuid, content, format, properties, pageId, tags);
        this.children = children;
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
        logseq.Editor.registerSlashCommand("Card (Incremental + Hide all, Test one)", [
            ["editor/input", `#card #incremental #hide-all-test-one`],
            ["editor/clear-current-slash"],
        ]);
        logseq.provideStyle(`
            .page-reference[data-ref=card], a[data-ref=card] {
                opacity: .3;
            }
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
            .page-reference[data-ref=card-group], a[data-ref=card-group] {
                opacity: .3;
            }
            .page-reference[data-ref=hide-all-test-one], a[data-ref=hide-all-test-one] {
                opacity: .3;
            }
        `);
        LogseqProxy.Editor.createTagSilentlyIfNotExists("card");
        LogseqProxy.Editor.createTagSilentlyIfNotExists("card-group");
        LogseqProxy.Editor.createTagSilentlyIfNotExists("flashcard");
        LogseqProxy.Editor.createTagSilentlyIfNotExists("forward");
        LogseqProxy.Editor.createTagSilentlyIfNotExists("reversed");
        LogseqProxy.Editor.createTagSilentlyIfNotExists("bidirectional");
        LogseqProxy.Editor.createTagSilentlyIfNotExists("incremental");
        for (let i = 1; i <= 9; i++) {
            LogseqProxy.Editor.createTagSilentlyIfNotExists(`depth-${i}`);
        }
    };

    private getCardDirection(): string {
        let direction = _.get(this, "properties.direction") as string | undefined;
        if (direction !== "->" && direction !== "<-" && direction !== "<->") {
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
        let maxDepth = (this.properties?.depth as number | undefined) || 9999;
        for (const tag of this.tags) {
            const match = /^depth-(\d+)$/i.exec(tag);
            if (match) {
                maxDepth = parseInt(match[1]);
            }
        }
        return maxDepth;
    }


    public async getClozedContentHTML(): Promise<HTMLFile> {
        let clozedContent = "";
        const clozedContentAssets: Set<string> = new Set();
        const direction = this.getCardDirection();

        // Remove clozes and double braces one after another.
        this.content = escapeClozesAndMacroDelimiters(this.content);

        // Render the parent block and add to clozedContent
        const parentBlockHTMLFile = await LogseqToHtmlConverterProxy.convertToHTMLFile(this.content, this.format);
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
                childrenListHTML += `\n<li class="children ${_.get(child, "properties['logseq.orderListType']") == "number" ? 'numbered' : ''}">`;
                const childContent = _.get(child, "content", "");
                let sanitizedChildContent = escapeClozesAndMacroDelimiters(childContent);
                const sanitizedChildHTMLFile = await LogseqToHtmlConverterProxy.convertToHTMLFile(
                    sanitizedChildContent,
                    child.format,
                );
                const sanitizedChildHTMLFileWithExtra = await appendExtraToHtmlFile(
                    sanitizedChildHTMLFile,
                    _.get(child, "properties.extra"),
                    child.format
                );
                let sanitizedChildHTML = sanitizedChildHTMLFileWithExtra.html;
                sanitizedChildHTMLFileWithExtra.assets.forEach((asset) => childrenListAssets.add(asset));
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

        // --- Add extra property content for parent block (non-indented) ---
        const result: HTMLFile = {
            html: clozedContent,
            assets: clozedContentAssets,
            tags: parentBlockHTMLFile.tags,
        };
        return appendExtraToHtmlFile(result, _.get(await LogseqProxy.Editor.getBlock(this.uuid), "properties.extra") as string, this.format, true);
    }

    public static async getNotesFromLogseqBlocks(
        otherNotes: Array<Note>,
    ): Promise<MultilineCardNote[]> {
        type DatascriptQueryResult = [] | [{uuid: BlockUUID; page: { id: number }; parent: { id: number }}][];
        let logseqCard_blocks : DatascriptQueryResult = [];
        let flashCard_blocks : DatascriptQueryResult = [];
        let logseqCardGroup_blocks : DatascriptQueryResult = [];
        if (!await LogseqProxy.App.checkCurrentIsDbGraph()) {
            logseqCard_blocks = await LogseqProxy.DB.datascriptQuery(`
                [:find (pull ?b [:block/uuid :block/page :block/parent])
                :where
                [?p :block/name "card"]
                [?b :block/refs ?p]
                ]`, {suppressErrors: false}) || [];
            flashCard_blocks = await LogseqProxy.DB.datascriptQuery(`
                [:find (pull ?b [:block/uuid :block/page :block/parent])
                :where
                [?p :block/name "flashcard"]
                [?b :block/refs ?p]
                ]`, {suppressErrors: false}) || [];
            logseqCardGroup_blocks = await LogseqProxy.DB.datascriptQuery(`
                [:find (pull ?b [:block/uuid :block/page :block/parent])
                :where
                [?r :block/name "card-group"]
                [?p :block/refs ?r]
                [?b :block/parent ?p]
                ]`, {suppressErrors: false}) || [];
        } else {
            logseqCard_blocks = await LogseqProxy.DB.datascriptQuery(`
                [:find (pull ?b [:block/uuid :block/page :block/parent])
                :where
                [?p :block/name "card"]
                [?b :block/tags ?p]
                ]`, {suppressErrors: false}) || [];
            flashCard_blocks = await LogseqProxy.DB.datascriptQuery(`
                [:find (pull ?b [:block/uuid :block/page :block/parent])
                :where
                [?p :block/name "flashcard"]
                [?b :block/tags ?p]
                ]`, {suppressErrors: false}) || [];
            logseqCardGroup_blocks = await LogseqProxy.DB.datascriptQuery(`
                [:find (pull ?b [:block/uuid :block/page :block/parent])
                :where
                [?r :block/name "card-group"]
                [?p :block/tags ?r]
                [?b :block/parent ?p]
                ]`, {suppressErrors: false}) || [];
        }
        logseqCardGroup_blocks = await Promise.all(
            logseqCardGroup_blocks.map(async (block) => {
                const uuid = getUUIDFromBlock(block[0]);
                const parent = block[0].parent.id;
                const parentBlock = await LogseqProxy.Editor.getBlock(parent);
                const tags = _.get(parentBlock, "properties.tags", []) as string[];
                block[0].tagsFromParentCardGroup = [...tags];
                return block;
            }),
        );
        let blocks = [
            ...(logseqCard_blocks || []),
            ...(flashCard_blocks || []),
            ...(logseqCardGroup_blocks || []),
        ];
        let notes = await Promise.all(
            blocks.map(async (b) => {
                const uuid = getUUIDFromBlock(b[0]);
                const pageId = b[0].page?.id;
                if (!pageId) return null;
                
                const tagsFromParentCardGroup = _.get(b[0], "tagsFromParentCardGroup", []);
                let block = await LogseqProxy.Editor.getBlock(uuid, {
                    includeChildren: true,
                });
                if (block) {
                    const blockTags = _.get(block, "properties.tags", []) as string[];
                    return new MultilineCardNote(
                        uuid,
                        block.content,
                        block.format,
                        block.properties || {},
                        pageId,
                        // Apply tags in parent card group block - #168
                        blockTags && blockTags.length > 0 ? blockTags : tagsFromParentCardGroup,
                        block.children,
                    );
                } else {
                    return null;
                }
            }),
        );
        logger.info("MultilineCardNote Loaded");
        notes = await Note.removeUnwantedNotes(notes) as MultilineCardNote[];
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
        }) as MultilineCardNote[];
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
