import { Note } from "./Note";
import "@logseq/libs";
import { escapeClozeAndSecoundBrace, safeReplace } from "../utils/utils";
import _ from "lodash";
import { MD_PROPERTIES_REGEXP, ORG_PROPERTIES_REGEXP } from "../constants";
import { LogseqProxy } from "../logseq/LogseqProxy";
import { convertToHTMLFile, HTMLFile } from "../converter/Converter";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";

export class SwiftArrowNote extends Note {
    public type = "swift_arrow";

    public constructor(
        uuid: string,
        content: string,
        format: string,
        properties: any,
        page: any,
    ) {
        super(uuid, content, format, properties, page);
    }

    public static initLogseqOperations = () => {};

    public async getClozedContentHTML(): Promise<HTMLFile> {
        let clozedContent: string = this.content;

        // Remove logseq properties as it might cause problems during cloze creation
        clozedContent = safeReplace(clozedContent, MD_PROPERTIES_REGEXP, ""); //Remove md properties
        clozedContent = safeReplace(clozedContent, ORG_PROPERTIES_REGEXP, ""); //Remove org properties
        // --- Add clozes ---
        clozedContent = safeReplace(
            clozedContent,
            /(.*?)(\s*(:<->|:->|:<-)\s*)(.+)/s,
            (match, g1, g2, g3, g4) => {
                let replacement = "";
                if (g3 == ":<-" || g3 == ":<->") {
                    replacement += `{{c2::${escapeClozeAndSecoundBrace(
                        g1,
                    ).trim()}}}`;
                } else replacement += `${g1.trim()}`;
                const beforeArrowSpace = g2.split(/(:<->|:->|:<-)/s)[0];
                const afterArrowSpace = g2.split(/(:<->|:->|:<-)/s)[2];
                replacement += `${beforeArrowSpace}<b>${g3}</b>${afterArrowSpace}`;
                if (g3 == ":->" || g3 == ":<->") {
                    replacement += `{{c1::${escapeClozeAndSecoundBrace(
                        g4,
                    ).trim()}}}`;
                } else replacement += `${g4.trim()}`;
                return replacement;
            },
        );

        return convertToHTMLFile(clozedContent, this.format);
    }

    public static async getNotesFromLogseqBlocks(): Promise<SwiftArrowNote[]> {
        const singleSwiftArrowBlocks = await logseq.DB.datascriptQuery(`
        [:find (pull ?b [*])
        :where
        [?b :block/content ?content]
        [(re-pattern ":(<->|->|<-)") ?regex]
        [(re-find ?regex ?content)]
        ]`);
        let blocks: any = [...singleSwiftArrowBlocks];
        blocks = await Promise.all(
            blocks.map(async (block) => {
                const uuid = getUUIDFromBlock(block[0]);
                const page = block[0].page
                    ? await LogseqProxy.Editor.getPage(block[0].page.id)
                    : {};
                block = block[0];
                if (!block.content) {
                    block = await LogseqProxy.Editor.getBlock(uuid);
                }
                if (block)
                    return new SwiftArrowNote(
                        uuid,
                        block.content,
                        block.format,
                        block.properties || {},
                        page,
                    );
                else {
                    return null;
                }
            }),
        );
        console.log("SwiftArrowNote Blocks Loaded");
        blocks = _.uniqBy(blocks, "uuid");
        blocks = _.without(blocks, undefined, null);
        blocks = _.filter(blocks, (block) => {
            // Remove template cards
            return (
                _.get(block, "properties.template") == null ||
                _.get(block, "properties.template") == undefined
            );
        });
        blocks = _.filter(blocks, (block) => {
            // Remove notes that do not genetate any clozes
            const block_content = block.content;
            let cardGenerated = false;
            safeReplace(
                block_content,
                /(.+?)(\s*(:<->|:->|:<-)\s*)(.+)/s,
                (match, ...groups) => {
                    cardGenerated = true;
                    return match;
                },
            );
            return cardGenerated;
        });
        return blocks;
    }
}
