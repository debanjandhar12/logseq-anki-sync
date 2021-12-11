import { Block } from "./block";
import '@logseq/libs'
import _ from 'lodash';

export class MultilineCardBlock extends Block {
    public type: string = "multiline_card";
    public children: any;
    public constructor(uuid: string, content: string, properties: any, page: any, children: any = []) {
        super(uuid, content, properties, page);
        this.children = children;
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
        if(direction != "->" && direction != "<-" && direction != "<->") direction = "->";
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
            result += `${child.content.replace(/\n/g, "</br>").replace(/\{\{c\d+::(.*)\}\}/g, "$2")}`;
            if(direction == "<->" || direction == "->")
                result += ` }}`;
            result += `\n</li>`;
        }
        result += `</ul>`;

        this.content = result;
        console.log(this.content);
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
        console.log(blocks);
        blocks = await Promise.all(blocks.map(async (block) => {
            let uuid = block[0].uuid["$uuid$"] || block[0].uuid.Wd;
            let page = (block[0].page) ? await logseq.Editor.getPage(block[0].page.id) : {};
            block = await logseq.Editor.getBlock(uuid,{includeChildren: true});
            return new MultilineCardBlock(uuid, block.content, block.properties || {}, page, block.children || []);
        }));

        return blocks;
    }
}