import { Note } from "./Note";
import '@logseq/libs'
import { safeReplace } from '../utils';
import _ from 'lodash';
import { MD_PROPERTIES_REGEXP, ORG_PROPERTIES_REGEXP } from "../constants";
import { SyncronizedLogseq } from "../SyncronizedLogseq";

export class SwiftNote extends Note {
    public type: string = "swift";

    public constructor(uuid: string, content: string, format: string, properties: any, page: any) {
        super(uuid, content, format, properties, page);
    }

    public static initLogseqOperations = (() => { });

    public addClozes(): SwiftNote {
        let result : string = this.content;

        // Remove logseq properties as it might cause problems during cloze creation
        result = safeReplace(result, MD_PROPERTIES_REGEXP, ""); //Remove md properties
        result = safeReplace(result, ORG_PROPERTIES_REGEXP, ""); //Remove org properties
    
        // --- Add clozes ---
        result = safeReplace(result, /(.*?)(\s*(:<->|:->|:<-)\s*)(.+)/s, (match, g1, g2, g3, g4) => {
            let replacement = "";
            if(g3 == ":<-" || g3 == ":<->") {
                replacement += `{{c2::${g1.trim()}}}`;
            }
            else replacement += `${g1.trim()}`;
            let beforeArrowSpace = g2.split(/(:<->|:->|:<-)/s)[0];
            let afterArrowSpace = g2.split(/(:<->|:->|:<-)/s)[2];
            replacement += `${beforeArrowSpace}<b>${g3}</b>${afterArrowSpace}`;
            if(g3 == ":->" || g3 == ":<->") {
                replacement += `{{c1::${g4.trim()}}}`;
            }
            else replacement += `${g4.trim()}`;
            return replacement;
        });

        this.content = result;
        return this;
    }

    public static async getNotesFromLogseqBlocks(): Promise<SwiftNote[]> {
        let singleSwiftBlocks = await logseq.DB.datascriptQuery(`
        [:find (pull ?b [*])
        :where
        [?b :block/content ?content]
        [(re-pattern "(?s)(.*?)(:<->|:->|:<-)(.+)") ?regex]
        [(re-find ?regex ?content)]
        ]`);
        let blocks: any = [...singleSwiftBlocks];
        blocks = await Promise.all(blocks.map(async (block) => {
            let uuid = block[0].uuid["$uuid$"] || block[0].uuid.Wd;
            let page = (block[0].page) ? await SyncronizedLogseq.Editor.getPage(block[0].page.id) : {};
            block = block[0];
            if(!block.content) {
                block = await SyncronizedLogseq.Editor.getBlock(uuid);
            }
            if(block)
                return new SwiftNote(uuid, block.content, block.format, block.properties || {}, page);
            else {
                return null;
            }
        }));
        console.log("SwiftNote Cards Loaded");
        blocks = _.uniqBy(blocks, 'uuid');
        blocks = _.without(blocks, undefined, null);
        blocks = _.filter(blocks, (block) => { // Remove template cards
            return _.get(block, 'properties.template') == null || _.get(block, 'properties.template') == undefined;
        });
        return blocks;
    }
}
