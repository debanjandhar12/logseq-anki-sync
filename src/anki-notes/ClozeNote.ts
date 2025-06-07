import {Note} from "./Note";
import "@logseq/libs";
import {
    string_to_arr,
    get_math_inside_md,
    safeReplace,
    escapeClozesAndMacroDelimiters,
} from "../utils/utils";
import _ from "lodash";
import {LOGSEQ_PLUGIN_CLOZE_REGEXP, MD_PROPERTIES_REGEXP, ORG_PROPERTIES_REGEXP} from "../constants";
import {LogseqProxy} from "../logseq/LogseqProxy";
import {HTMLFile, convertToHTMLFile} from "../logseq/LogseqToHtmlConverter";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";


export class ClozeNote extends Note {
    public type = "cloze";

    public constructor(
        uuid: string,
        content: string,
        format: string,
        properties: any,
        page: any,
        tagIds: number[],
    ) {
        super(uuid, content, format, properties, page, tagIds);
    }

    public static initLogseqOperations = () => {
        // Init logseq operations at start of the program
        logseq.Editor.registerSlashCommand("Replace Cloze", [
            ["editor/input", `replacecloze:: " '' "`, {"backward-pos": 3}],
            ["editor/clear-current-slash"],
        ]);
        logseq.provideStyle(`
            .page-reference[data-ref=type-in], a[data-ref=type-in] {
                opacity: .3;
            }
        `);
        LogseqProxy.Editor.createPageSilentlyIfNotExists("type-in");

        const { hideClozeMarcosUntilHoverInLogseq } = LogseqProxy.Settings.getPluginSettings();
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
        } 
        else {
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
                    'span[title^="Unsupported macro name: c"]',
                );
                if (!clozes) return;
                clozes = elem.querySelectorAll('span[title^="Unsupported macro name: c"]');
                clozes.forEach(async (cloze) => {
                    if (/c(loze)?[1-9]$/.test((cloze as Element & { title }).title)) {
                        let content = cloze.innerHTML.replace(
                            LOGSEQ_PLUGIN_CLOZE_REGEXP,
                            "$2",
                        );
                        const { renderClozeMarcosInLogseq } = LogseqProxy.Settings.getPluginSettings();
                        if (renderClozeMarcosInLogseq)
                            content = (await convertToHTMLFile(content, "markdown", {displayTags: true, processRefEmbeds: false})).html;
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
                } else displayAnkiCloze(window.parent.document.body as Element);
            });
            observer.observe(window.parent.document, {
                subtree: true,
                childList: true,
            });
        };
        setupAnkiClozeObserverAndRenderThemInLogseqWhenObserved();
    };

    public async getClozedContentHTML(): Promise<HTMLFile> {
        let cloze_id = 1;
        let clozedContent: string = this.content;

        // --- Remove logseq properties and store it in removedLogseqProperties as it might cause problems during cloze creation ---
        let removedLogseqProperties = "";
        clozedContent = safeReplace(clozedContent, MD_PROPERTIES_REGEXP, (match) => {
            removedLogseqProperties += match;
            return "";
        }); //Remove md properties
        clozedContent = safeReplace(clozedContent, ORG_PROPERTIES_REGEXP, (match) => {
            removedLogseqProperties += match;
            return "";
        }); //Remove org properties
        if (!removedLogseqProperties.trim().endsWith("\n")) removedLogseqProperties += "\n";

        // --- Add anki cloze marco clozes ---
        clozedContent = safeReplace(
            clozedContent,
            /\{\{(c|cloze)([1-9]) (.*?)\}\}/g,
            (match, group1, group2, group3) => {
                cloze_id = Math.max(cloze_id, parseInt(group2) + 1);
                group3 = group3.replace(
                    /(.*)(\\\\|::)(.*)/,
                    (match, g1, g2, g3) => `${g1.trim()}::${g3.trim()}`,
                ); // Add support for logseq cloze cue
                return `{{c${parseInt(group2)}::${group3}}}`;
            },
        );

        // --- Add anki-cloze array clozes ---
        const replaceclozeProp = this.properties.replacecloze
            ? this.properties.replacecloze
            : this.properties[".replacecloze"];
        if (replaceclozeProp) {
            let replaceclozeArr: any;
            try {
                if (typeof replaceclozeProp == "string" && replaceclozeProp.trim() != "") {
                    replaceclozeArr = string_to_arr(replaceclozeProp.replace(/(^\s*"|\s*"$)/g, ""));
                }
                else if (
                    typeof replaceclozeProp == "object" &&
                    replaceclozeProp.constructor == Array) {
                    replaceclozeArr = string_to_arr(replaceclozeProp.join(","));
                }
                else replaceclozeArr = [];
            } catch (e) {
                throw "Error parsing replacecloze property";
            }

            const replaceclozehintProp = this.properties.replaceclozehint
                ? this.properties.replaceclozehint
                : this.properties[".replaceclozehint"];
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
                        },
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

        // --- Add logseq clozes ---
        clozedContent = safeReplace(clozedContent, /\{\{cloze (.*?)\}\}/g, (match, group1) => {
            group1 = group1.replace(
                /(.*)(\\\\|::)(.*)/,
                (match, g1, g2, g3) => `${g1.trim()}::${g3.trim()}`,
            ); // Add support for logseq cloze cue
            return `{{c${cloze_id++}::${group1}}}`;
        });

        // --- Add org block clozes ---
        clozedContent = safeReplace(
            clozedContent,
            /#\+BEGIN_(CLOZE)( .*)?\n((.|\n)*?)#\+END_\1/gi,
            function (match, g1, g2, g3) {
                return `{{c${cloze_id++}::${g3.trim()}}}`;
            },
        );

        // --- Add back the removed logseq properties ---
        clozedContent = removedLogseqProperties + clozedContent;

        return convertToHTMLFile(clozedContent, this.format);
    }

    public static async getNotesFromLogseqBlocks(): Promise<ClozeNote[]> {
        // Get blocks with Anki or Logseq cloze macro syntax
        const clozeRegex = /{{(c[1-9]|cloze[1-9]?) .*}}/;
        const clozePattern = clozeRegex.source.replace(/\\/g, "\\\\");
        const macroCloze_blocks = await LogseqProxy.DB.datascriptQuery(`
        [:find (pull ?b [*])
        :where
        (or
           (and [?b :block/content ?content])
           (and [?b :block/title ?content]))
        [(re-pattern "${clozePattern}") ?regex]
        [(re-find ?regex ?content)]
        ]`);
        // Get blocks with .replacecloze or replacecloze property
        const replaceCloze_blocks = await LogseqProxy.DB.datascriptQuery(`
        [:find (pull ?b [*])
        :where
          [?b :block/properties ?p]
          (or
            [(get ?p :replacecloze)]
            [(get ?p :.replacecloze)]
          )
        ]`);
        // Get blocks with org cloze
        const orgCloze_blocks = await LogseqProxy.DB.datascriptQueryBlocks(`
        [:find (pull ?b [*])
        :where
        (or
           (and [?b :block/content ?content])
           (and [?b :block/title ?content]))
        [(re-pattern "#\\\\+BEGIN_(CLOZE)( .*)?\\\\n((.|\\\\n)*?)#\\\\+END_\\\\1") ?regex]
        [(re-find ?regex ?content)]
        ]`);
        let blocks: any = [...macroCloze_blocks, ...replaceCloze_blocks, ...orgCloze_blocks];
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
                    return new ClozeNote(
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
        notes = await Note.removeUnwantedNotes(notes);
        return notes;
    }
}
