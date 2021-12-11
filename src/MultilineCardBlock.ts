import { Block } from "./block";
import '@logseq/libs'
import _ from 'lodash';

export class MultilineCardBlock extends Block {
    public type: string = "multiline_card";
    public children: any[];
    public tags: any[];
    public constructor(uuid: string, content: string, properties: any, page: any, tags: any = [], children: any = []) {
        super(uuid, content, properties, page);
        this.children = children;
        this.tags = tags;
    }

    public static initLogseqOperations = (() => { // Init logseq operations at start of the program
        logseq.Editor.registerSlashCommand("Card", [
            ["editor/input", `#card`],
            ["editor/clear-current-slash"],
        ]);
    });

    public addClozes(): MultilineCardBlock {
        let result = this.content;
        let direction = _.get(this, 'properties.direction');
        if(direction != "->" && direction != "<-" && direction != "<->") {
            if((this.tags.includes("backward") && this.tags.includes("forward")) || this.tags.includes("bidirectional")) direction = "<->";
            else if(this.tags.includes("backward")) direction = "<-";
            else direction = "->";
        } 

        // Add cloze to the parent block if direction is <-> or <-
        result = result.replace(/\{\{c\d+::(.*)\}\}/g, "$2");
        if(direction == "<->" || direction == "<-") 
            result = `{{c2:: \n ${result} \n}}`;
        
        // Add the content of children blocks and cloze it if direction is <-> or ->
        result+=`\n<ul class="children-list">`;
        for(const child of this.children) {
            result += `\n<li class="children">`;
            if(direction == "<->" || direction == "->")
                result += `{{c1::`;
            result += `${child.html_content.replace(/\{\{c\d+::(.*)\}\}/g, "$2")}`;
            if(direction == "<->" || direction == "->")
                result += ` }}`;
            result += `</li>`;
        }
        result += `</ul>`;

        this.content = result;
        return this;
    }


    public static async getBlocksFromLogseq(): Promise<MultilineCardBlock[]> {
        let logseqCard_blocks = await logseq.DB.datascriptQuery(`
        [:find (pull ?b [*])
        :where
        [?p :block/name "card"]
        [?b :block/refs ?p]
        ]`);
        let blocks: any = [...logseqCard_blocks];
        blocks = await Promise.all(blocks.map(async (block) => {
            let uuid = block[0].uuid["$uuid$"] || block[0].uuid.Wd;
            let page = (block[0].page) ? await logseq.Editor.getPage(block[0].page.id) : {};
            block = await logseq.Editor.getBlock(uuid,{includeChildren: true});
            let tags = await Promise.all(_.map(block.refs, async page => { return (await logseq.Editor.getPage(page.id)).name; }));
            let children = await Promise.all(_.map(block.children, async child => _.extend({html_content: await Block.convertToHtml(child.content)}, child))) || [];
            return new MultilineCardBlock(uuid, block.content, block.properties || {}, page, tags, children);
        }));

        return blocks;
    }
}