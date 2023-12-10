import {Note} from "./Note";
import "@logseq/libs";
import {escapeClozeAndSecoundBrace, getRandomUnicodeString, safeReplace} from "../utils/utils";
import _ from "lodash";
import {MD_PROPERTIES_REGEXP, ORG_PROPERTIES_REGEXP} from "../constants";
import {LogseqProxy} from "../logseq/LogseqProxy";
import {convertToHTMLFile, HTMLFile} from "../converter/Converter";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";

export class SwiftArrowNote extends Note {
    public type = "swift_arrow";

    public constructor(
        uuid: string,
        content: string,
        format: string,
        properties: any,
        page: any,
        tagIds: number[] = [],
    ) {
        super(uuid, content, format, properties, page, tagIds);
    }

    public static initLogseqOperations = () => {};

    public async getClozedContentHTML(): Promise<HTMLFile> {
        let clozedContent: string = this.content;

        // Remove logseq properties as it might cause problems during cloze creation
        clozedContent = safeReplace(clozedContent, MD_PROPERTIES_REGEXP, ""); //Remove md properties
        clozedContent = safeReplace(clozedContent, ORG_PROPERTIES_REGEXP, ""); //Remove org properties
        console.log(clozedContent);

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
                replacement += `${beforeArrowSpace}<b>${g3}</b>${afterArrowSpace}`;
                if (g3 == ":->" || g3 == ":<->") {
                    replacement += `${startDoubleBracket}1${doubleSemicolon}${g4.trim()}${endDoubleBracket}`;
                } else replacement += `${g4.trim()}`;
                return replacement;
            },
        );
        clozedContent = escapeClozeAndSecoundBrace(clozedContent);
        clozedContent = clozedContent.replaceAll(startDoubleBracket, "{{c");
        clozedContent = clozedContent.replaceAll(doubleSemicolon, "::");
        clozedContent = clozedContent.replaceAll(endDoubleBracket, "}}");
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
        let notes = await Promise.all(
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
                        _.get(block, "refs", []).map((ref) => ref.id),
                    );
                else {
                    return null;
                }
            }),
        );
        console.log("SwiftArrowNote Blocks Loaded");
        notes = await Note.removeUnwantedNotes(notes);
        notes = _.filter(notes, (note) => {
            // Remove notes that do not genetate any clozes
            const note_content = note.content;
            let cardGenerated = false;
            safeReplace(
                note_content,
                /(.+?)(\s*(:<->|:->|:<-)\s*)(.+)/s,
                (match, ...groups) => {
                    cardGenerated = true;
                    return match;
                },
            );
            return cardGenerated;
        });
        return notes;
    }
}
