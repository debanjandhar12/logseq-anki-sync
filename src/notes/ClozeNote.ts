import { Note } from "./Note";
import '@logseq/libs'
import { string_to_arr, get_math_inside_md, safeReplace } from '../utils';
import _ from 'lodash';
import { MD_PROPERTIES_REGEXP, ORG_PROPERTIES_REGEXP } from "../constants";

export class ClozeNote extends Note {
    public type: string = "cloze";

    public constructor(uuid: string, content: string, format: string, properties: any, page: any, parent: number) {
        super(uuid, content, format, properties, page, parent);
    }

    public static initLogseqOperations = (() => { // Init logseq operations at start of the program
        logseq.Editor.registerSlashCommand("Replace Cloze", [
            ["editor/input", `replacecloze:: " '' "`, {"backward-pos": 3}],
            ["editor/clear-current-slash"],
        ]);
    });

    public addClozes(): ClozeNote {
        let cloze_id = 1;
        let result : string = this.content;

        // Remove logseq properties as it might cause problems during cloze creation
        result = safeReplace(result, MD_PROPERTIES_REGEXP, ""); //Remove md properties
        result = safeReplace(result, ORG_PROPERTIES_REGEXP, ""); //Remove org properties
    
        // --- Add anki-cloze array clozes ---
        if(this.properties.replacecloze) {
            let replaceclozeArr: any;
            if(typeof this.properties.replacecloze == "string" && this.properties.replacecloze.trim() != "") {
                replaceclozeArr = string_to_arr(this.properties.replacecloze.replace(/(^\s*"|\s*"$)/g, ''));
            }
            else if (typeof this.properties.replacecloze == "object" && this.properties.replacecloze.constructor == Array) { 
                replaceclozeArr = string_to_arr(this.properties.replacecloze.join(','));
            }
            else replaceclozeArr = [];

            // Add the clozes while ensuring that adding cloze in math mode double braces doesn't break the cloze
            // This is done by adding extra space the braces between two double brace
            let math = get_math_inside_md(result); // get list of math inside md
            for (let [i, reg] of replaceclozeArr.entries()) {
                if (typeof reg == "string")
                    result = result.replaceAll(reg.replaceAll(`\\"`, `"`).replaceAll(`\\'`, `'`).trim(), (match) => {
                        if (math.find(math => math.includes(match)))
                            return `{{c${cloze_id}::${match.replace(/(?<!{{embed [^}\n]*?)}}/g, "} } ")} }}`; // Add extra space between braces
                        else
                            return `{{c${cloze_id}::${match}}}`;
                    });
                else
                    result = result.replace(reg, (match) => {
                        if (math.find(math => math.includes(match)))
                            return `{{c${cloze_id}::${match.replace(/(?<!{{embed [^}\n]*?)}}/g, "} } ")} }}`; // Add extra space between braces
                        else
                            return `{{c${cloze_id}::${match}}}`;
                    });
                cloze_id++;
            }
        }

        // --- Add logseq clozes ---
        result = safeReplace(result, /\{\{cloze (.*?)\}\}/g, (match, group1) => {
            return `{{c${cloze_id++}::${group1}}}`;
        });

        // --- Add org block clozes ---
        result = safeReplace(result, /#\+BEGIN_(CLOZE)( .*)?\n((.|\n)*?)#\+END_\1/gi, function (match, g1, g2, g3) { 
            return `{{c${cloze_id++}::\n${g3.trim()}\n}}`;
        });

        this.content = result;
        return this;
    }

    public static async getNotesFromLogseqBlocks(): Promise<ClozeNote[]> {
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
            if(block)
                return new ClozeNote(uuid, block.content, block.format, block.properties || {}, page, block.parent.id);
            else return null;
        }));
        blocks = _.uniqBy(blocks, 'uuid');
        blocks = _.without(blocks, undefined, null);

        return blocks;
    }
}
