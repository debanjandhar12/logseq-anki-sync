import { Note } from "./Note";
import '@logseq/libs';
import _ from 'lodash';
import { convertToHTMLFile, HTMLFile } from '../converter/CachedConverter';
import { safeReplace } from '../utils';
import { ANKI_CLOZE_REGEXP, MD_PROPERTIES_REGEXP } from "../constants";
import { SyncronizedLogseq } from "../SyncronizedLogseq";
import { BlockUUID } from "@logseq/libs/dist/LSPlugin.user";

export class MultilineCardNote extends Note {
    public type: string = "multiline_card";
    public children: any[];
    public tags: any[];
    private childrenAssets: Set<string> = new Set();
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

    public async getClozedContentHTML(): Promise<HTMLFile> {
        let clozedContent = this.content;
        let direction = this.getCardDirection();

        // Remove clozes and double braces one after another
        clozedContent = clozedContent.replace(ANKI_CLOZE_REGEXP, "$3");
        clozedContent = clozedContent.replace(/(?<!{{embed [^}\n]*?)}}/g, "} } ");
        
        // Add cloze to the parent block if direction is <-> or <-
        clozedContent = safeReplace(clozedContent, MD_PROPERTIES_REGEXP, "");
        if (direction == "<->" || direction == "<-")
            clozedContent = `{{c2:: ${clozedContent} }}`;

        // Add the content of children blocks and cloze it if direction is <-> or ->
        let cloze_id = 1;
        
        let maxDepth = this.getChildrenMaxDepth();
        let getChildrenListHTMLFile = async (childrenList: any, level: number = 0) : Promise<HTMLFile> => {
            if (level >= maxDepth) return {html: "", assets: new Set<string>()};
            let childrenListAssets = new Set<string>();
            let childrenListHTML = `\n<ul class="children-list left-border">`;
            for (let child of childrenList) {
                childrenListHTML += `\n<li class="children">`;
                let childContent = _.get(child,"content", "");
                let sanitizedChildContent = childContent.replace(ANKI_CLOZE_REGEXP, "$3").replace(/(?<!{{embed [^}\n]*?)}}/g, "} } ");
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
            return {html: childrenListHTML, assets: childrenListAssets};
        }
        let childrenHTMLFile = await getChildrenListHTMLFile(this.children);
        childrenHTMLFile.assets.forEach(asset => this.childrenAssets.add(asset));
        clozedContent += childrenHTMLFile.html;
        
        return convertToHTMLFile(clozedContent, this.format);
    }

    public static async getNotesFromLogseqBlocks(): Promise<MultilineCardNote[]> {
        let logseqCard_blocks = await SyncronizedLogseq.DB.datascriptQueryBlocks(`
        [:find (pull ?b [*])
        :where
        [?p :block/name "card"]
        [?b :block/refs ?p]
        ]`);
        let flashCard_blocks = await SyncronizedLogseq.DB.datascriptQueryBlocks(`
        [:find (pull ?b [*])
        :where
        [?p :block/name "flashcard"]
        [?b :block/refs ?p]
        ]`);
        let blocks: any = [...logseqCard_blocks, ...flashCard_blocks];
        
        blocks = await Promise.all(blocks.map(async (block) => {
            let uuid = block[0].uuid["$uuid$"] || block[0].uuid.Wd;
            let page = (block[0].page) ? await SyncronizedLogseq.Editor.getPage(block[0].page.id) : {};
            block = await SyncronizedLogseq.Editor.getBlock(uuid, { includeChildren: true });
            if (block) {
                let tags = await Promise.all(_.map(block.refs, async page => {
                        let tagPage = await SyncronizedLogseq.Editor.getPage(page.id);
                        return _.get(tagPage, 'name') 
                    }));
                return new MultilineCardNote(uuid, block.content, block.format, block.properties || {}, page, tags, block.children);
            } else {
               return null;
            }
        }));
        console.log("MultilineCardNote Loaded");
        blocks = _.uniqBy(blocks, 'uuid');
        blocks = _.without(blocks, undefined, null);
        blocks = _.filter(blocks, (block) => { // Remove template cards
            return _.get(block, 'properties.template') == null || _.get(block, 'properties.template') == undefined;
        });
        blocks = _.filter(blocks, (block) => { // Remove cards that do not have children and are not reversed or bidirectional
            return block.getCardDirection() == "<->" || block.getCardDirection() == "<-" || block.children.length > 0;
        });
        return blocks;
    }

    public getDirectDeendencies(): BlockUUID[] {
        function getChildrenUUID(children: any): BlockUUID[] {
            let result = [];
            for (let child of children) {
                result.push(child.uuid);
                result = result.concat(getChildrenUUID(child.children));
            }
            return result;
        }
        console.log("getDirectDeendencies", [this.uuid,...getChildrenUUID(this.children)]);
        return [this.uuid,...getChildrenUUID(this.children)];
    }
}