import { Block } from "./block";
import '@logseq/libs'
import { string_to_arr, get_math_inside_md } from './utils';
import _ from 'lodash';

export class ClozeBlock extends Block {
    public type: string = "cloze";

    public constructor(uuid: string, content: string, properties: any, page: any) {
        super(uuid, content, properties, page);
    }

    public static initLogseqOperations = (() => { // Init logseq operations at start of the program
        logseq.Editor.registerSlashCommand("Replace Cloze", [
            ["editor/input", `replacecloze:: " '' "`, {"backward-pos": 3}],
            ["editor/clear-current-slash"],
        ]);
    });

    public addClozes(): ClozeBlock {
        let cloze_id = 1;
        let result = this.content;

        // Remove logseq properties as it might cause problems during cloze creation
        result = result.replace(/^\s*(\w|-)*::.*/gm, "");

        // --- Add anki-cloze array clozes ---
        let replaceclozeArr: any = `${this.properties.replacecloze}`;
        if (replaceclozeArr && replaceclozeArr.trim() != "" && replaceclozeArr != 'undefined') { replaceclozeArr = string_to_arr(replaceclozeArr); }
        else { replaceclozeArr = []; }
        console.log(`${this.properties.replacecloze}`, replaceclozeArr);

        // Add the clozes while ensuring that adding cloze in math mode double braces doesn't break the cloze
        // This is done by adding extra space the braces between two double brace
        let math = get_math_inside_md(result); // get list of math inside md
        for (let [i, reg] of replaceclozeArr.entries()) {
            if (typeof reg == "string")
                // @ts-expect-error
                result = result.replaceAll(reg.replaceAll(`\\"`, `"`).replaceAll(`\\'`, `'`).trim(), (match) => {
                    if (math.find(math => math.includes(match)))
                        return `{{c${cloze_id}::${match.replace(/}}/g, "} } ")} }}`; // Add extra space between braces
                    else
                        return `{{c${cloze_id}::${match}}}`;
                });
            else
                result = result.replace(reg, (match) => {
                    if (math.find(math => math.includes(match)))
                        return `{{c${cloze_id}::${match.replace(/}}/g, "} } ")} }}`; // Add extra space between braces
                    else
                        return `{{c${cloze_id}::${match}}}`;
                });
            cloze_id++;
        }

        // --- Add logseq clozes ---
        result = result.replace(/\{\{cloze (.*)\}\}/g, (match, group1) => {
            return `{{c${cloze_id++}::${group1}}}`;
        });

        // --- Add org block clozes ---
        result = result.replace(/#\+BEGIN_(CLOZE)( .*)?\n((.|\n)*?)#\+END_\1/gi, function (match, g1, g2, g3) { 
            return `<span class="cloze">{{c${cloze_id++}::\n${g3.trim()}\n}}</span>`;
        });

        this.content = result;
        return this;
    }

    public static async getBlocksFromLogseq(): Promise<ClozeBlock[]> {
        let replaceCloze_blocks = await logseq.DB.datascriptQuery(`
        [:find (pull ?b [*])
        :where
          [?b :block/properties ?p]
          [(get ?p :replacecloze)]
        ]`);
        let logseqCloze_blocks = await logseq.DB.datascriptQuery(`
        [:find (pull ?b [*])
        :where
        [?b :block/content ?content]
        [(re-pattern "{{cloze .*}}") ?regex]
        [(re-find ?regex ?content)]
        ]`);
        let orgCloze_blocks = await logseq.DB.datascriptQuery(`
        [:find (pull ?b [*])
        :where
        [?b :block/content ?content]
        [(re-pattern "#\\\\+BEGIN_(CLOZE)( .*)?\\\\n((.|\\\\n)*?)#\\\\+END_\\\\1") ?regex]
        [(re-find ?regex ?content)]
        ]`);
        let blocks: any = [...logseqCloze_blocks, ...replaceCloze_blocks, ...orgCloze_blocks];
        blocks = await Promise.all(blocks.map(async (block) => {
            let uuid = block[0].uuid["$uuid$"] || block[0].uuid.Wd;
            let page = (block[0].page) ? await logseq.Editor.getPage(block[0].page.id) : {};
            block = await logseq.Editor.getBlock(uuid);
            return new ClozeBlock(uuid, block.content, block.properties || {}, page);
        }));
        blocks = _.uniqBy(blocks, 'uuid');

        return blocks;
    }
}