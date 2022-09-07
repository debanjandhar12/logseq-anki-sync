import { Note } from "./Note";
import '@logseq/libs'
import { string_to_arr, get_math_inside_md, safeReplace, escapeClozeAndSecoundBrace } from '../utils';
import _ from 'lodash';
import { MD_PROPERTIES_REGEXP, ORG_PROPERTIES_REGEXP } from "../constants";
import { LogseqProxy } from "../LogseqProxy";
import { HTMLFile } from "../converter/Converter";
import { convertToHTMLFile } from "../converter/Converter";

export class ClozeNote extends Note {
    public type: string = "cloze";

    public constructor(uuid: string, content: string, format: string, properties: any, page: any) {
        super(uuid, content, format, properties, page);
    }

    public static initLogseqOperations = (() => { // Init logseq operations at start of the program
        logseq.Editor.registerSlashCommand("Replace Cloze", [
            ["editor/input", `replacecloze:: " '' "`, {"backward-pos": 3}],
            ["editor/clear-current-slash"],
        ]);
    });

    public async getClozedContentHTML(): Promise<HTMLFile> {
        let cloze_id = 1;
        let clozedContent : string = this.content;

        // Remove logseq properties as it might cause problems during cloze creation
        clozedContent = safeReplace(clozedContent, MD_PROPERTIES_REGEXP, ""); //Remove md properties
        clozedContent = safeReplace(clozedContent, ORG_PROPERTIES_REGEXP, ""); //Remove org properties
    
        // --- Add anki cloze marco clozes ---
        clozedContent = safeReplace(clozedContent, /\{\{c(\d) (.*?)\}\}/g, (match, group1, group2) => {
            cloze_id = Math.max(cloze_id, parseInt(group1) + 1);
            return `{{c${parseInt(group1)}::${group2}}}`;
        });
  
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

            let replaceclozeHintArr: any;
            if(typeof this.properties.replaceclozehint == "string" && this.properties.replaceclozehint.trim() != "") {
                replaceclozeHintArr = this.properties.replaceclozehint.replace(/(^\s*"|\s*"$)/g, '').split(',');
            }
            else if (typeof this.properties.replaceclozehint == "object" && this.properties.replaceclozehint.constructor == Array) { 
                replaceclozeHintArr = this.properties.replaceclozehint;
            }
            else replaceclozeHintArr = [];
            replaceclozeHintArr = replaceclozeHintArr.map(hint => hint.trim());

            // Add the clozes while ensuring that adding cloze in math mode double braces doesn't break the cloze
            // This is done by adding extra space the braces between two double brace
            for (let [i, reg] of replaceclozeArr.entries()) {
                if (typeof reg == "string")
                    clozedContent = clozedContent.replaceAll(reg.replaceAll(`\\"`, `"`).replaceAll(`\\'`, `'`).trim(), (match) => {
                            return `{{c${cloze_id}::${escapeClozeAndSecoundBrace(match)}${replaceclozeHintArr[i] ? `::${replaceclozeHintArr[i]}` : ""}\u{2063}}}`; // Add extra space between braces inside math
                    });
                else
                    clozedContent = clozedContent.replace(reg, (match) => {
                            return `{{c${cloze_id}::${escapeClozeAndSecoundBrace(match)}${replaceclozeHintArr[i] ? `::${replaceclozeHintArr[i]}` : ""}\u{2063}}}`; // Add extra space between braces inside math
                    });
                cloze_id++;
            }
        }

        // --- Add logseq clozes ---
        clozedContent = safeReplace(clozedContent, /\{\{cloze (.*?)\}\}/g, (match, group1) => {
            return `{{c${cloze_id++}::${group1}}}`;
        });

        // --- Add org block clozes ---
        clozedContent = safeReplace(clozedContent, /#\+BEGIN_(CLOZE)( .*)?\n((.|\n)*?)#\+END_\1/gi, function (match, g1, g2, g3) { 
            return `{{c${cloze_id++}::\n${g3.trim()}\n}}`;
        });

        return convertToHTMLFile(clozedContent, this.format);
    }

    public static async getNotesFromLogseqBlocks(): Promise<ClozeNote[]> {
        let ankiMacroCloze_blocks = await LogseqProxy.DB.datascriptQuery(`
        [:find (pull ?b [*])
        :where
        [?b :block/content ?content]
        [(re-pattern "{{c[0-9] .*}}") ?regex]
        [(re-find ?regex ?content)]
        ]`);
        let replaceCloze_blocks = await LogseqProxy.DB.datascriptQuery(`
        [:find (pull ?b [*])
        :where
          [?b :block/properties ?p]
          [(get ?p :replacecloze)]
        ]`);
        let logseqCloze_blocks = await LogseqProxy.DB.datascriptQueryBlocks(`
        [:find (pull ?b [*])
        :where
        [?b :block/content ?content]
        [(re-pattern "{{cloze .*}}") ?regex]
        [(re-find ?regex ?content)]
        ]`);
        let orgCloze_blocks = await LogseqProxy.DB.datascriptQueryBlocks(`
        [:find (pull ?b [*])
        :where
        [?b :block/content ?content]
        [(re-pattern "#\\\\+BEGIN_(CLOZE)( .*)?\\\\n((.|\\\\n)*?)#\\\\+END_\\\\1") ?regex]
        [(re-find ?regex ?content)]
        ]`);
        let blocks: any = [...ankiMacroCloze_blocks, ...logseqCloze_blocks, ...replaceCloze_blocks, ...orgCloze_blocks];
        blocks = await Promise.all(blocks.map(async (block) => {
            let uuid = block[0].uuid || block[0].uuid["$uuid$"] || block[0].uuid.Wd;
            let page = (block[0].page) ? await LogseqProxy.Editor.getPage(block[0].page.id) : {};
            block = block[0];
            if(!block.content) {
                block = await LogseqProxy.Editor.getBlock(uuid);
            }
            if(block)
                return new ClozeNote(uuid, block.content, block.format, block.properties || {}, page);
            else {
                return null;
            }
        }));
        console.log("ClozeNote Cards Loaded");
        blocks = _.uniqBy(blocks, 'uuid');
        blocks = _.without(blocks, undefined, null);
        blocks = _.filter(blocks, (block) => { // Remove template cards
            return _.get(block, 'properties.template') == null || _.get(block, 'properties.template') == undefined;
        });
        return blocks;
    }
}
