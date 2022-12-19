import { Note } from "./Note";
import '@logseq/libs';
import _ from 'lodash';
import { convertToHTMLFile, HTMLFile } from '../converter/Converter';
import { escapeClozeAndSecoundBrace, safeReplace } from '../utils/utils';
import { ANKI_CLOZE_REGEXP, MD_PROPERTIES_REGEXP } from "../constants";
import { LogseqProxy } from "../logseq/LogseqProxy";
import { BlockUUID } from "@logseq/libs/dist/LSPlugin.user";
import { DependencyEntity } from "../converter/getContentDirectDependencies";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";

export class MultilineCardNote extends Note {
    public type: string = "multiline_card";
    public children: any[];
    public tags: any[];
    public constructor(uuid: string, content: string, format: string, properties: any, page: any, tags: any = [], children: any = []) {
        super(uuid, content, format, properties, page);
        this.children = children;
        this.tags = tags;
    }

    public static initLogseqOperations = (() => { // Init logseq operations at start of the program
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
        `);
    });

    private getCardDirection(): String {
        let direction = _.get(this, 'properties.direction');
        if (direction != "->" && direction != "<-" && direction != "<->") {
            if ((this.tags.includes("reversed") && this.tags.includes("forward")) || this.tags.includes("bidirectional")) direction = "<->";
            else if (this.tags.includes("reversed")) direction = "<-";
            else direction = "->";
        }
        return direction;
    }

    private getChildrenMaxDepth(): Number {
        let maxDepth = _.get(this, 'properties.depth') || 9999;
        for (let tag of this.tags) { 
            let match = /^depth-(\d+)$/i.exec(tag);
            if (match) {
                maxDepth = parseInt(match[1]);
            }
        }
        return maxDepth;
    }

    private static async getImportantTags(tagIds: any[]): Promise<string[]> {
        let tags = [], tagIdSet = new Set(tagIds);
        let tagPage;
        tagPage = await LogseqProxy.Editor.getPage("forward");
        if (tagPage && tagPage.id && tagIdSet.has(tagPage.id)) tags.push("forward");
        tagPage = await LogseqProxy.Editor.getPage("reversed");
        if (tagPage && tagPage.id && tagIdSet.has(tagPage.id)) tags.push("reversed");
        tagPage = await LogseqProxy.Editor.getPage("bidirectional");
        if (tagPage && tagPage.id && tagIdSet.has(tagPage.id)) tags.push("bidirectional");
        tagPage = await LogseqProxy.Editor.getPage("incremental");
        if (tagPage && tagPage.id && tagIdSet.has(tagPage.id)) tags.push("incremental");
        for (let i = 0; i < 10; i++) {
            tagPage = await LogseqProxy.Editor.getPage("depth-" + i);
            if (tagPage && tagPage.id && tagIdSet.has(tagPage.id)) {
                tags.push("depth-" + i);
                break;
            }
        }
        return tags;
    }

    public async getClozedContentHTML(): Promise<HTMLFile> {
        let clozedContent = "";
        let clozedContentAssets: Set<string> = new Set();
        if(this.tags == null)
            this.tags = await Promise.all(_.map((await LogseqProxy.Editor.getBlock(this.uuid)).refs, async page => {
                let tagPage = await LogseqProxy.Editor.getPage(page.id);
                return _.get(tagPage, 'name') 
            }));
        let direction = this.getCardDirection();

        // Remove clozes and double braces one after another.
        this.content = escapeClozeAndSecoundBrace(this.content);

        // Render the parent block and add to clozedContent
        let parentBlockHTMLFile = await convertToHTMLFile(this.content, this.format);
        parentBlockHTMLFile.assets.forEach(asset => clozedContentAssets.add(asset));
        if (direction == "<->" || direction == "<-") // Insert cloze braces depending upon direction else simply add parent block html to clozedContent
            clozedContent = `{{c2::${parentBlockHTMLFile.html}}}`;
        else clozedContent = parentBlockHTMLFile.html;

        // Add the content of children blocks and cloze it if direction is <-> or ->
        let cloze_id = 1;
        let maxDepth = this.getChildrenMaxDepth();
        let getChildrenListHTMLFile = async (childrenList: any, level: number = 0) : Promise<HTMLFile> => {
            if (level >= maxDepth) return {html: "", assets: new Set<string>(), tags: []};
            let childrenListAssets = new Set<string>();
            let childrenListHTML = `\n<ul class="children-list left-border">`;
            for (let child of childrenList) {
                childrenListHTML += `\n<li class="children">`;
                let childContent = _.get(child,"content", "");
                let sanitizedChildContent = escapeClozeAndSecoundBrace(childContent);
                let childExtra = _.get(child,"properties.extra");
                if(childExtra) {sanitizedChildContent += `\n<div class="extra">${childExtra}</div>`;}    
                let sanitizedChildHTMLFile = await convertToHTMLFile(sanitizedChildContent, child.format);
                let sanitizedChildHTML = sanitizedChildHTMLFile.html;
                let sanitizedChildAssets = sanitizedChildHTMLFile.assets;
                sanitizedChildAssets.forEach(asset => childrenListAssets.add(asset));
                if (child.children.length > 0) {
                    let allChildrenHTMLFile = await getChildrenListHTMLFile(child.children, level + 1);
                    sanitizedChildHTML += allChildrenHTMLFile.html;
                    allChildrenHTMLFile.assets.forEach(asset => childrenListAssets.add(asset));
                }

                if(level == 0 && (direction == "<->" || direction == "->")) {
                        childrenListHTML += `{{c${cloze_id}:: ${sanitizedChildHTML} }}`;
                    if(this.tags.includes("incremental")) cloze_id++;
                    if(cloze_id == 2) cloze_id++;
                } else childrenListHTML += sanitizedChildHTML;
                childrenListHTML += `</li>`;
            }
            childrenListHTML += `</ul>`;
            return {html: childrenListHTML, assets: childrenListAssets, tags: []};
        }
        let childrenHTMLFile = await getChildrenListHTMLFile(this.children);
        childrenHTMLFile.assets.forEach(asset => clozedContentAssets.add(asset));
        clozedContent += childrenHTMLFile.html;

        if (this.children.length == 0 && (direction == "<->" || direction == "->")) clozedContent += `{{c${cloze_id}::}}`; // #16
        
        return {html: clozedContent, assets: clozedContentAssets, tags: parentBlockHTMLFile.tags};
    }

    public static async getNotesFromLogseqBlocks(otherNotes : Array<Note>): Promise<MultilineCardNote[]> {
        let logseqCardGroup_blocks = await LogseqProxy.DB.datascriptQueryBlocks(`
        [:find (pull ?b [*])
        :where
        [?r :block/name "card-group"]
        [?p :block/refs ?r]
        [?b :block/parent ?p]
        ]`);
        let logseqCard_blocks = await LogseqProxy.DB.datascriptQueryBlocks(`
        [:find (pull ?b [*])
        :where
        [?p :block/name "card"]
        [?b :block/refs ?p]
        ]`);
        let flashCard_blocks = await LogseqProxy.DB.datascriptQueryBlocks(`
        [:find (pull ?b [*])
        :where
        [?p :block/name "flashcard"]
        [?b :block/refs ?p]
        ]`);
        let blocks: any = [...logseqCard_blocks, ...flashCard_blocks, ...logseqCardGroup_blocks];
        blocks = await Promise.all(blocks.map(async (block) => {
            let uuid = getUUIDFromBlock(block[0]);
            let page = (block[0].page) ? await LogseqProxy.Editor.getPage(block[0].page.id) : {};
            block = await LogseqProxy.Editor.getBlock(uuid, { includeChildren: true });
            if (block) {
                let tags = await MultilineCardNote.getImportantTags(_.get(block,"refs", []).map(ref => ref.id));
                return new MultilineCardNote(uuid, block.content, block.format, block.properties || {}, page, tags, block.children);
            } else {
               return null;
            }
        }));
        console.log("MultilineCardNote Loaded");
        blocks = _.uniqBy(blocks, 'uuid');
        blocks = _.without(blocks, undefined, null);
        blocks = _.filter(blocks, (block) => { // Remove template blocks
            return _.get(block, 'properties.template') == null || _.get(block, 'properties.template') == undefined;
        });
        blocks = _.filter(blocks, (block) => { // Retain only blocks whose children count > 0 or direction is expictly specifed or no other note type is being generated from that block
            return _.get(block, 'properties.direction') || block.tags.includes("forward") || block.tags.includes("bidirectional") || block.tags.includes("reversed") || block.children.length > 0 || !_.find(otherNotes, {uuid: block.uuid});
        });

        return blocks;
    }

    public getBlockDependencies(): DependencyEntity[] {
        function getChildrenUUID(children: any): BlockUUID[] {
            let result = [];
            for (let child of children) {
                result.push(child.uuid);
                result = result.concat(getChildrenUUID(child.children));
            }
            return result;
        }
        return [this.uuid,...getChildrenUUID(this.children)].map(block => ({ type: "Block", value: block } as DependencyEntity));
    }
}