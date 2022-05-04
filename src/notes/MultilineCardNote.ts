import { Note } from "./Note";
import '@logseq/libs';
import _ from 'lodash';
import { convertToHTMLFile, HTMLFile } from '../converter/CachedConverter';
import { safeReplace } from '../utils';
import { ANKI_CLOZE_REGEXP, MD_PROPERTIES_REGEXP } from "../constants";

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

    public addClozes(): MultilineCardNote {
        let result = this.content;
        let direction = this.getCardDirection();

        // Remove clozes and double braces one after another
        result = result.replace(ANKI_CLOZE_REGEXP, "$3");
        result = result.replace(/(?<!{{embed [^}\n]*?)}}/g, "} } ");
        
        // Add cloze to the parent block if direction is <-> or <-
        result = safeReplace(result, MD_PROPERTIES_REGEXP, "");
        if (direction == "<->" || direction == "<-")
            result = `{{c2:: ${result} }}`;

        // Add the content of children blocks and cloze it if direction is <-> or ->
        let cloze_id = 1;
        
        let maxDepth = this.getChildrenMaxDepth();
        let addChildrenToResult = (children: any, level: number = 0) => {
            if (level >= maxDepth) return "";
            let result = `\n<ul class="children-list left-border">`;
            for (let child of children) {
                result += `\n<li class="children">`;
                let sanitized_html_content = child.htmlFile.html.replace(/(\{\{c(\d+)::)((.|\n)*)\}\}/g, "$3");
                child.htmlFile.assets.forEach(asset => this.childrenAssets.add(asset));
                if (child.children.length > 0) sanitized_html_content += addChildrenToResult(child.children, level + 1);

                if(level == 0 && (direction == "<->" || direction == "->")) {
                        result += `{{c${cloze_id}:: ${sanitized_html_content} }}`;
                    if(this.tags.includes("incremental")) cloze_id++;
                    if(cloze_id == 2) cloze_id++;
                } else result += sanitized_html_content;
                result += `</li>`;
            }
            result += `</ul>`;
            return result;
        }
        result += addChildrenToResult(this.children);
        
        this.content = result;
        return this;
    }

    private static async augmentChildrenArray(children: any): Promise<any> {
        let output = await Promise.all(_.map(children, 
            async child => {
                let child_extra = _.get(child,"properties.extra");
                let child_content = _.get(child,"content").replace(ANKI_CLOZE_REGEXP, "$3").replace(/(?<!{{embed [^}\n]*?)}}/g, "} } ") || "";
                if(child_extra) {child_content += `\n<div class="extra">${child_extra}</div>`;}
                let new_children = await this.augmentChildrenArray(_.get(child,"children") || []);
                return _.assign(child, {htmlFile: await convertToHTMLFile(child_content, _.get(child,"format") || "markdown"), children: new_children})
            })) || [];
        return output;
    }

    public static async getNotesFromLogseqBlocks(): Promise<MultilineCardNote[]> {
        let logseqCard_blocks = await logseq.DB.datascriptQuery(`
        [:find (pull ?b [*])
        :where
        [?p :block/name "card"]
        [?b :block/refs ?p]
        ]`);
        let flashCard_blocks = await logseq.DB.datascriptQuery(`
        [:find (pull ?b [*])
        :where
        [?p :block/name "flashcard"]
        [?b :block/refs ?p]
        ]`);
        let blocks: any = [...logseqCard_blocks, ...flashCard_blocks];
        blocks = await Promise.all(blocks.map(async (block) => {
            let uuid = block[0].uuid["$uuid$"] || block[0].uuid.Wd;
            let page = (block[0].page) ? await logseq.Editor.getPage(block[0].page.id) : {};
            block = await logseq.Editor.getBlock(uuid, { includeChildren: true });
            if (block) {
                let tags = await Promise.all(_.map(block.refs, async page => { return _.get(await logseq.Editor.getPage(page.id), 'name') }));
                let children = await this.augmentChildrenArray(block.children);
                return new MultilineCardNote(uuid, block.content, block.format, block.properties || {}, page, tags, children);
            } else return null;
        }));
        blocks = _.uniqBy(blocks, 'uuid');
        blocks = _.without(blocks, undefined, null);
        blocks = _.filter(blocks, (block) => { // Remove cards that do not have children and are not reversed or bidirectional
            return block.getCardDirection() == "<->" || block.getCardDirection() == "<-" || block.children.length > 0;
        });
        return blocks;
    }

    public async convertToHtmlFile(): Promise<HTMLFile> {
        let {html, assets} = await convertToHTMLFile(this.content, this.format);
        this.childrenAssets.forEach(asset => assets.add(asset));
        return {html, assets};
    }
}