import {Note} from "./Note";
import "@logseq/libs";
import type {BlockUUID} from "@logseq/libs/dist/LSPlugin.user";
import _ from "lodash";
import {createLogger, LoggerCategory} from "../logger";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";
import {LogseqContentPreprocessor} from "../logseq/LogseqContentPreprocessor";
import {LogseqProxy} from "../logseq/LogseqProxy";
import {type HTMLFile, LogseqToHtmlConverterProxy} from "../logseq/LogseqToHtmlConverter";
import {escapeClozesAndMacroDelimiters, getRandomUnicodeString, safeReplace} from "../utils/utils";
import {appendExtraToHtmlFile} from "./NoteUtils";

const logger = createLogger(LoggerCategory.AnkiNotes);

export class SwiftArrowNote extends Note {
    public type = "swift_arrow";

    public constructor(
        uuid: string,
        content: string,
        format: string,
        properties: any,
        pageId: number,
        tags: string[] = []
    ) {
        super(uuid, content, format, properties, pageId, tags);
    }

    public static initLogseqOperations = () => {};

    public async getClozedContentHTML(): Promise<HTMLFile> {
        let clozedContent: string = this.content;

        // Remove logseq properties as it might cause problems during cloze creation
        [clozedContent] = LogseqContentPreprocessor.extractProperties(
            clozedContent,
            this.format as "markdown" | "org"
        );
        logger.info(clozedContent);

        // --- Add clozes ---
        const endDoubleBracket = getRandomUnicodeString();
        const startDoubleBracket = getRandomUnicodeString();
        const doubleSemicolon = getRandomUnicodeString();
        clozedContent = safeReplace(
            clozedContent,
            /(.*?)(\s*(:<->|:->|:<-)\s*)(.+)/s,
            (match, g1, g2, g3, g4) => {
                let replacement = "";
                if (g3 == ":<-" || g3 == ":<->") {
                    replacement += `${startDoubleBracket}2${doubleSemicolon}${g1.trim()}${endDoubleBracket}`;
                } else replacement += `${g1.trim()}`;
                const beforeArrowSpace = g2.split(/(:<->|:->|:<-)/s)[0];
                const afterArrowSpace = g2.split(/(:<->|:->|:<-)/s)[2];
                replacement +=
                    `${beforeArrowSpace}${beforeArrowSpace.endsWith(" ") ? "" : " "}` +
                    `<b>${g3}</b>` +
                    `${afterArrowSpace.startsWith(" ") ? "" : " "}${afterArrowSpace}`;
                if (g3 == ":->" || g3 == ":<->") {
                    replacement += `${startDoubleBracket}1${doubleSemicolon}${g4.trim()}${endDoubleBracket}`;
                } else replacement += `${g4.trim()}`;
                return replacement;
            }
        );
        clozedContent = escapeClozesAndMacroDelimiters(clozedContent);
        clozedContent = clozedContent.replaceAll(startDoubleBracket, "{{c");
        clozedContent = clozedContent.replaceAll(doubleSemicolon, "::");
        clozedContent = clozedContent.replaceAll(endDoubleBracket, "}}");

        const result = await LogseqToHtmlConverterProxy.convertToHTMLFile(
            clozedContent,
            this.format
        );

        // --- Add extra property content (non-indented) ---
        return appendExtraToHtmlFile(
            result,
            _.get(await LogseqProxy.Editor.getBlock(this.uuid), "properties.extra") as string,
            this.format,
            true
        );
    }

    public static async getNotesFromLogseqBlocks(): Promise<SwiftArrowNote[]> {
        type DatascriptQueryResult = [] | [{uuid: BlockUUID; page: {id: number}}][];
        const singleSwiftArrowBlocks: DatascriptQueryResult = await LogseqProxy.DB.datascriptQuery(
            `
        [:find (pull ?b [:block/uuid :block/page])                                                                                                                    
         :where                                                                                                                                                       
         [(re-pattern ":(<->|->|<-)") ?regex]                                                                                                                         
         (or                                                                                                                                                          
           (and [?b :block/content ?content]                                                                                                                          
                [(re-find ?regex ?content)])                                                                                                                          
           (and [?b :block/title ?content]                                                                                                                            
                [(re-find ?regex ?content)]))]`,
            {suppressErrors: false}
        );
        const blocks = [...(singleSwiftArrowBlocks || [])];
        let notes = await Promise.all(
            blocks.map(async (b) => {
                const uuid = getUUIDFromBlock(b[0]);
                const pageId = _.get(b[0], "page.id");
                if (!pageId) return null;

                const block = await LogseqProxy.Editor.getBlock(uuid);
                if (block)
                    return new SwiftArrowNote(
                        uuid,
                        block.content,
                        block.format,
                        block.properties || {},
                        pageId,
                        _.get(block, "properties.tags", []) as string[]
                    );
                else {
                    return null;
                }
            })
        );
        logger.info("SwiftArrowNote Blocks Loaded");
        notes = await Note.removeUnwantedNotes(notes);
        notes = _.filter(notes, (note) => {
            // Remove notes that do not genetate any clozes
            const note_content = note.content;
            let cardGenerated = false;
            safeReplace(note_content, /(.+?)(\s*(:<->|:->|:<-)\s*)(.+)/s, (match, ...groups) => {
                cardGenerated = true;
                return match;
            });
            return cardGenerated;
        });
        return notes;
    }
}
