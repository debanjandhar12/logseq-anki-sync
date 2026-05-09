import {Note} from "./Note";
import "@logseq/libs";
import type {BlockEntity, BlockUUID} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import {createLogger, LoggerCategory} from "../logger";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";
import {LogseqContentPreprocessor} from "../logseq/LogseqContentPreprocessor";
import {LogseqPropertiesHelper} from "../logseq/LogseqPropertiesHelper";
import {LogseqProxy} from "../logseq/LogseqProxy";
import {type HTMLFile, LogseqToHtmlConverterProxy} from "../logseq/LogseqToHtmlConverter";
import {type HighlightMaskData, showHighlightMaskEditor} from "../ui";
import {getHealedHighlightGeometry, matchTextQuote} from "../utils/HighlightNoteQuotePosFinder";
import {ObjectPropertyDataManager} from "../utils/ObjectPropertyDataManager";
import {escapeClozesAndMacroDelimiters} from "../utils/utils";
import {appendExtraToHtmlFile} from "./NoteUtils";

const logger = createLogger(LoggerCategory.AnkiNotes);

export class HighlightMaskNote extends Note {
    public type = "highlight_mask";

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

    public static initLogseqOperations = () => {
        // Only register for DB graphs
        LogseqProxy.App.checkCurrentIsDbGraph().then((isDbGraph) => {
            if (!isDbGraph) return;

            logseq.Editor.registerBlockContextMenuItem("Highlight Mask", async (block) => {
                await HighlightMaskNote.handleHighlightMaskOperation(block);
            });
            logseq.Editor.registerSlashCommand("Highlight Mask", async (block) => {
                await HighlightMaskNote.handleHighlightMaskOperation(block);
            });
            LogseqProxy.Editor.registerProperty("highlight_mask", {
                type: "default",
                cardinality: "one",
                hide: false
            });
        });
    };

    public static async handleHighlightMaskOperation(block: BlockEntity | {uuid: string}) {
        const uuid = getUUIDFromBlock(block as BlockEntity);

        // Get fresh block with properties
        const fetchedBlock = await LogseqPropertiesHelper.getBlock(uuid);
        if (!fetchedBlock) {
            await logseq.UI.showMsg("Block not found.", "error");
            return;
        }

        // Get raw content
        let [rawContent] = LogseqContentPreprocessor.extractProperties(fetchedBlock.content || "");
        rawContent = rawContent.trim();

        if (!rawContent) {
            await logseq.UI.showMsg("Block has no content to highlight.", "warning");
            return;
        }

        // Load existing highlight data
        const highlightData: HighlightMaskData = (ObjectPropertyDataManager.load(
            fetchedBlock,
            "highlight_mask"
        ) as HighlightMaskData) || {
            elements: [],
            config: {},
            tags: []
        };

        logger.info("Opening Highlight Mask Editor", highlightData);

        // Get block tags
        const blockTags = _.get(fetchedBlock, "properties.tags", []) as string[];

        // Open editor
        const newHighlightData = await showHighlightMaskEditor(
            rawContent,
            highlightData.elements || [],
            highlightData.config || {},
            blockTags
        );

        if (newHighlightData && typeof newHighlightData === "object") {
            await ObjectPropertyDataManager.save(fetchedBlock, "highlight_mask", newHighlightData);

            // Handle tag updates for hide-all-test-one
            const blockUUID = getUUIDFromBlock(fetchedBlock);
            const tag = await logseq.Editor.getTag("hide-all-test-one");
            if (tag) {
                if (newHighlightData.tags.includes("hide-all-test-one")) {
                    await logseq.Editor.addBlockTag(blockUUID, tag.uuid);
                } else {
                    await logseq.Editor.removeBlockTag(blockUUID, tag.uuid);
                }
            }
        }
    }

    public async getClozedContentHTML(): Promise<HTMLFile> {
        let clozedContent: string = this.content;

        // Load highlight data
        const highlightData: HighlightMaskData = (ObjectPropertyDataManager.load(
            this,
            "highlight_mask"
        ) as HighlightMaskData) || {
            elements: [],
            config: {},
            tags: []
        };

        // Get raw content without properties to safely insert cloze syntax
        let [rawContent, , removedLogseqProperties] = LogseqContentPreprocessor.extractProperties(
            clozedContent,
            this.format as "markdown" | "org"
        );

        // Escape existing cloze delimiters in the raw content first
        rawContent = escapeClozesAndMacroDelimiters(rawContent);

        // Find the matches first, then insert clozes from back to front to avoid position shifting
        const replacements = [];

        for (const element of highlightData.elements) {
            const healResult = await getHealedHighlightGeometry(rawContent, element);

            if (healResult) {
                if (healResult.healed) {
                    Object.assign(element, healResult.element);
                    await ObjectPropertyDataManager.save(
                        this as any,
                        "highlight_mask",
                        highlightData
                    );
                }

                replacements.push({
                    start: healResult.actualStart,
                    end: healResult.actualStart + element.text.length,
                    element
                });
            } else {
                logger.warn(
                    `HighlightMask: Could not locate text "${element.text}" in block content.`
                );
            }
        }

        // Sort from end to start to avoid shifting earlier substitution positions
        replacements.sort((a, b) => b.start - a.start);

        for (const {start, end, element} of replacements) {
            const matchedText = rawContent.substring(start, end);
            const hintSuffix = element.hint ? `::${element.hint}` : "";
            const clozeText = `{{c${element.cId}::${matchedText}${hintSuffix}\u{2063}}}`; // Add extra space between braces

            rawContent = rawContent.substring(0, start) + clozeText + rawContent.substring(end);
        }

        // Add back properties
        clozedContent = removedLogseqProperties + rawContent;

        const result = await LogseqToHtmlConverterProxy.convertToHTMLFile(
            clozedContent,
            this.format
        );

        // Add extra property content
        return appendExtraToHtmlFile(
            result,
            _.get(await LogseqProxy.Editor.getBlock(this.uuid), "properties.extra") as string,
            this.format,
            true
        );
    }

    public static async getNotesFromLogseqBlocks(): Promise<HighlightMaskNote[]> {
        // Only works for DB graphs
        const isDbGraph = await LogseqProxy.App.checkCurrentIsDbGraph();
        if (!isDbGraph) {
            return [];
        }

        type DatascriptQueryResult = [] | [{uuid: BlockUUID; page: {id: number}}][];

        // Query blocks with highlight_mask property in DB graph
        const blocks: DatascriptQueryResult = await LogseqProxy.DB.datascriptQuery(
            `
            [:find (pull ?b [:block/uuid :block/page])
             :where
               [?prop-e :block/tags :logseq.class/Property]
               [?prop-e :db/ident ?prop]
               [(name ?prop) ?prop-name]
               [(clojure.string/ends-with? ?prop-name "highlight_mask")]
               [?b ?prop _]
            ]`,
            {suppressErrors: false}
        );

        const notes: (HighlightMaskNote | false)[] = await Promise.all(
            (blocks || []).map(async (b) => {
                const uuid = getUUIDFromBlock(b[0]);
                if (!uuid) return false;
                const pageId = _.get(b[0], "page.id");
                if (!pageId) return false;

                const block = await LogseqProxy.Editor.getBlock(uuid);
                if (block) {
                    return new HighlightMaskNote(
                        uuid,
                        block.content,
                        block.format,
                        block.properties || {},
                        pageId,
                        (block.properties?.tags ?? []) as string[]
                    );
                } else {
                    return false;
                }
            })
        );

        logger.info("HighlightMaskNote Loaded", notes);
        let validNotes = (await Note.removeUnwantedNotes(
            notes.filter(Boolean) as Note[]
        )) as HighlightMaskNote[];

        // Filter out notes without valid highlight data
        validNotes = (
            await Promise.all(
                validNotes.map(async (note) => {
                    try {
                        const highlightData = ObjectPropertyDataManager.load(
                            note,
                            "highlight_mask"
                        ) as HighlightMaskData | null;

                        if (
                            highlightData?.elements &&
                            Array.isArray(highlightData.elements) &&
                            highlightData.elements.length > 0
                        ) {
                            const rawText = note.content;
                            const matchResults = await Promise.all(
                                highlightData.elements.map((el) =>
                                    matchTextQuote(rawText, {
                                        exact: el.text,
                                        prefix: el.prefix,
                                        suffix: el.suffix
                                    })
                                )
                            );
                            return matchResults.some((res) => res !== null) ? note : null;
                        }
                    } catch {
                        return null;
                    }
                    return null;
                })
            )
        ).filter((note): note is HighlightMaskNote => note !== null);

        return validNotes;
    }
}
