import {Note} from "./Note";
import "@logseq/libs";
import type {BlockUUID} from "@logseq/libs/dist/LSPlugin.user";
import _ from "lodash";
import {LOGSEQ_PLUGIN_CLOZE_REGEXP} from "../constants";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";
import {LogseqContentPreprocessor} from "../logseq/LogseqContentPreprocessor";
import {LogseqProxy} from "../logseq/LogseqProxy";
import {type HTMLFile, LogseqToHtmlConverterProxy} from "../logseq/LogseqToHtmlConverter";
import {WindowParentBridge} from "../logseq/WindowParentBridge";
import {escapeClozesAndMacroDelimiters, safeReplace, string_to_arr} from "../utils/utils";
import {appendExtraToHtmlFile} from "./NoteUtils";

export class ClozeNote extends Note {
    public type = "cloze";

    public constructor(
        uuid: string,
        content: string,
        format: string,
        properties: any,
        pageId: number,
        tags: string[]
    ) {
        super(uuid, content, format, properties, pageId, tags);
    }

    public static initLogseqOperations = () => {
        // Init logseq operations at start of the program
        logseq.Editor.registerSlashCommand("Replace Cloze", [
            ["editor/input", `replacecloze:: " '' "`, {"backward-pos": 3}],
            ["editor/clear-current-slash"]
        ]);
        logseq.provideStyle(`
            .page-reference[data-ref=type-in], a[data-ref=type-in] {
                opacity: .3;
            }
        `);
        LogseqProxy.Editor.createTagSilentlyIfNotExists("type-in");
        LogseqProxy.App.checkCurrentIsDbGraph().then((isDbGraph) => {
            if (!isDbGraph) {
                LogseqProxy.Editor.registerProperty("replacecloze", {
                    type: "default",
                    cardinality: "one",
                    hide: false
                });
            }
        });
        const {hideClozeMarcosUntilHoverInLogseq} = LogseqProxy.Settings.getPluginSettings();
        if (hideClozeMarcosUntilHoverInLogseq) {
            logseq.provideStyle(`
                .anki-cloze {
                    color: transparent !important;
                    background: unset !important;
                    text-decoration: underline 1px dashed var(--ls-primary-text-color) !important;
                    text-underline-position: under !important;
                }
                .anki-cloze:hover {
                    color: var(--ls-primary-text-color) !important;
                    background: unset !important;
                }
            `);
        } else {
            logseq.provideStyle(`
                .anki-cloze {
                    background-color:rgb(59 130 246 / 0.1);
                }
            `);
        }
        const setupAnkiClozeObserverAndRenderThemInLogseqWhenObserved = () => {
            // Set up observer for Anki Cloze Macro Syntax
            const displayAnkiCloze = (elem: Element) => {
                let clozes: Element | NodeListOf<Element> = elem.querySelector(
                    'span[title^="Unsupported macro name: c"]'
                );
                if (!clozes) return;
                clozes = elem.querySelectorAll('span[title^="Unsupported macro name: c"]');
                clozes.forEach(async (cloze) => {
                    if (/c(loze)?[1-9]$/.test((cloze as Element & {title}).title)) {
                        let content = cloze.innerHTML.replace(LOGSEQ_PLUGIN_CLOZE_REGEXP, "$2");
                        const {renderClozeMarcosInLogseq} =
                            LogseqProxy.Settings.getPluginSettings();
                        if (renderClozeMarcosInLogseq)
                            content = (
                                await LogseqToHtmlConverterProxy.convertToHTMLFile(
                                    content,
                                    "markdown",
                                    {displayTags: true, processRefEmbeds: false}
                                )
                            ).html;
                        // if parent element has class macro
                        if (cloze.parentElement.classList.contains("macro"))
                            cloze.parentElement.style.display = "initial";
                        cloze.outerHTML = `<span class="anki-cloze" style="white-space: initial;" title="${cloze.innerHTML}">${content}</span>`;
                    }
                });
            };
            const observer = new MutationObserver((mutations) => {
                if (mutations.length <= 8) {
                    for (const mutation of mutations) {
                        const addedNode = mutation.addedNodes[0];
                        if (addedNode && addedNode.childNodes.length) {
                            displayAnkiCloze(addedNode as Element);
                        }
                    }
                } else displayAnkiCloze(WindowParentBridge.getBody() as Element);
            });
            observer.observe(WindowParentBridge.getDocument(), {
                subtree: true,
                childList: true
            });
        };
        setupAnkiClozeObserverAndRenderThemInLogseqWhenObserved();
    };

    public async getClozedContentHTML(): Promise<HTMLFile> {
        let cloze_id = 1;
        let clozedContent: string = this.content;

        // --- Remove logseq properties and store it in removedLogseqProperties as it might cause problems during cloze creation ---
        const [contentWithoutProperties, , removedLogseqProperties] =
            LogseqContentPreprocessor.extractProperties(
                clozedContent,
                this.format as "markdown" | "org"
            );
        clozedContent = contentWithoutProperties;

        // --- Add anki cloze marco clozes ---
        clozedContent = safeReplace(
            clozedContent,
            /\{\{(c|cloze)([1-9]) (.*?)\}\}/g,
            (match, group1, group2, group3) => {
                cloze_id = Math.max(cloze_id, parseInt(group2) + 1);
                group3 = group3.replace(
                    /(.*)(\\\\|::)(.*)/,
                    (match, g1, g2, g3) => `${g1.trim()}::${g3.trim()}`
                ); // Add support for logseq cloze cue
                return `{{c${parseInt(group2)}::${group3}}}`;
            }
        );

        // --- Add replace clozes ---
        if (!(await LogseqProxy.App.checkCurrentIsDbGraph())) {
            const replaceclozeProp =
                this.properties?.replacecloze ?? this.properties?.[".replacecloze"];
            if (replaceclozeProp) {
                let replaceclozeArr: any;
                try {
                    if (typeof replaceclozeProp == "string" && replaceclozeProp.trim() != "") {
                        replaceclozeArr = string_to_arr(
                            replaceclozeProp.replace(/(^\s*"|\s*"$)/g, "")
                        );
                    } else if (
                        typeof replaceclozeProp == "object" &&
                        replaceclozeProp.constructor == Array
                    ) {
                        replaceclozeArr = string_to_arr(replaceclozeProp.join(","));
                    } else replaceclozeArr = [];
                } catch (e) {
                    throw new Error(
                        `Error parsing replacecloze property: ${e instanceof Error ? e.message : String(e)}`,
                        {cause: e}
                    );
                }

                const replaceclozehintProp =
                    this.properties?.replaceclozehint ?? this.properties?.[".replaceclozehint"];
                let replaceclozeHintArr: any;
                if (typeof replaceclozehintProp == "string" && replaceclozehintProp.trim() != "") {
                    replaceclozeHintArr = replaceclozehintProp
                        .replace(/(^\s*"|\s*"$)/g, "")
                        .split(",");
                } else if (
                    typeof replaceclozehintProp == "object" &&
                    replaceclozehintProp.constructor == Array
                ) {
                    replaceclozeHintArr = replaceclozehintProp;
                } else replaceclozeHintArr = [];
                replaceclozeHintArr = replaceclozeHintArr.map((hint) => hint.trim());

                // Add the clozes while ensuring that adding cloze in math mode double braces doesn't break the cloze
                // This is done by adding extra space the braces between two double brace
                for (const [i, reg] of replaceclozeArr.entries()) {
                    if (typeof reg == "string")
                        clozedContent = clozedContent.replaceAll(
                            reg.replaceAll(`\\"`, `"`).replaceAll(`\\'`, `'`).trim(),
                            (match) => {
                                return `{{c${cloze_id}::${escapeClozesAndMacroDelimiters(match)}${
                                    replaceclozeHintArr[i] ? `::${replaceclozeHintArr[i]}` : ""
                                }\u{2063}}}`; // Add extra space between braces inside math
                            }
                        );
                    else
                        clozedContent = clozedContent.replace(reg, (match) => {
                            return `{{c${cloze_id}::${escapeClozesAndMacroDelimiters(match)}${
                                replaceclozeHintArr[i] ? `::${replaceclozeHintArr[i]}` : ""
                            }\u{2063}}}`; // Add extra space between braces inside math
                        });
                    cloze_id++;
                }
            }
        }

        // --- Add logseq clozes ---
        clozedContent = safeReplace(clozedContent, /\{\{cloze (.*?)\}\}/g, (match, group1) => {
            group1 = group1.replace(
                /(.*)(\\\\|::)(.*)/,
                (match, g1, g2, g3) => `${g1.trim()}::${g3.trim()}`
            ); // Add support for logseq cloze cue
            return `{{c${cloze_id++}::${group1}}}`;
        });

        // --- Add org block clozes ---
        clozedContent = safeReplace(
            clozedContent,
            /#\+BEGIN_(CLOZE)( .*)?\n((.|\n)*?)#\+END_\1/gi,
            (match, g1, g2, g3) => `{{c${cloze_id++}::${g3.trim()}}}`
        );

        // --- Add back the removed logseq properties ---
        clozedContent = removedLogseqProperties + clozedContent;

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

    public static async getNotesFromLogseqBlocks(): Promise<ClozeNote[]> {
        type DatascriptQueryResult = [] | [{uuid: BlockUUID; page: {id: number}}][];
        // Get blocks with Anki or Logseq cloze macro syntax
        const clozeRegex = /{{(c[1-9]|cloze[1-9]?) .*}}/;
        const clozePattern = clozeRegex.source.replace(/\\/g, "\\\\");
        const macroCloze_blocks: DatascriptQueryResult = await LogseqProxy.DB.datascriptQuery(
            `
        [:find (pull ?b [:block/uuid :block/page])                                                                                                                    
         :where                                                                                                                                                       
         [(re-pattern "${clozePattern}") ?regex]                                                                                                                      
         (or                                                                                                                                                          
           (and [?b :block/content ?content]                                                                                                                          
                [(re-find ?regex ?content)])                                                                                                                          
           (and [?b :block/title ?content]                                                                                                                            
                [(re-find ?regex ?content)]))]`,
            {suppressErrors: false}
        );
        // Get blocks with or replacecloze property and org mode cloze
        let replaceCloze_blocks: DatascriptQueryResult = [];
        let orgCloze_blocks: DatascriptQueryResult = [];
        if (!(await LogseqProxy.App.checkCurrentIsDbGraph())) {
            replaceCloze_blocks = await LogseqProxy.DB.datascriptQuery(
                `
                [:find (pull ?b [:block/uuid :block/page])
                :where
                  [?b :block/properties ?p]
                  [(get ?p :replacecloze)]
                ]`,
                {suppressErrors: false}
            );
            orgCloze_blocks = await LogseqProxy.DB.datascriptQuery(
                `
            [:find (pull ?b [:block/uuid :block/page])                                                                                                                
             :where                                                                                                                                                   
             [(re-pattern "#\\\\+BEGIN_(CLOZE)( .*)?\\\\n((.|\\\\n)*?)#\\\\+END_\\\\1") ?regex]                                                                       
             (or                                                                                                                                                      
               (and [?b :block/content ?content]                                                                                                                      
                    [(re-find ?regex ?content)])                                                                                                                      
               (and [?b :block/title ?content]                                                                                                                        
                    [(re-find ?regex ?content)]))]`,
                {suppressErrors: false}
            );
        }

        const blocks = [
            ...(macroCloze_blocks || []),
            ...(replaceCloze_blocks || []),
            ...(orgCloze_blocks || [])
        ];
        let notes = await Promise.all(
            blocks.map(async (b) => {
                const uuid = getUUIDFromBlock(b[0]);
                const pageId = b[0].page?.id;
                if (!pageId) return null;

                const block = await LogseqProxy.Editor.getBlock(uuid);
                if (block)
                    return new ClozeNote(
                        uuid,
                        block.content,
                        block.format,
                        block.properties || {},
                        pageId,
                        (block.properties?.tags ?? []) as string[]
                    );
                else {
                    return null;
                }
            })
        );
        notes = await Note.removeUnwantedNotes(notes);
        return notes;
    }
}
