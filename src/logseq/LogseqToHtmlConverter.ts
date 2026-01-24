import hljs from "highlight.js";
import "@logseq/libs";
import * as cheerio from "cheerio";
import {
    decodeHTMLEntities,
    escapeClozesAndMacroDelimiters,
    getFirstNonEmptyLine,
    getRandomUnicodeString,
    safeReplace,
    safeReplaceAsync,
    safeParseInt,
} from "../utils/utils";
import _ from "lodash";
import {Mldoc} from "mldoc";
import {
    ANKI_CLOZE_REGEXP,
    LOGSEQ_BLOCK_REF_REGEXP,
    MD_IMAGE_EMBEDED_REGEXP,
    isImage_REGEXP,
    isWebURL_REGEXP,
    LOGSEQ_EMBDED_PAGE_REGEXP,
    LOGSEQ_EMBDED_BLOCK_REGEXP,
    LOGSEQ_PAGE_REF_REGEXP,
    LOGSEQ_RENAMED_BLOCK_REF_REGEXP,
    MD_MATH_BLOCK_REGEXP,
    ORG_MATH_BLOCK_REGEXP,
    specialChars,
    LOGSEQ_RENAMED_PAGE_REF_REGEXP,
    isAudio_REGEXP,
    isVideo_REGEXP
} from "../constants";
import * as hiccupConverter from "@thi.ng/hiccup";
import {edn} from "@yellowdig/cljs-tools";
import path from "path-browserify";
import getNameFromPage from "./getNameFromPage";
import getIDFromPage from "./getIDFromPage";
import {LogseqContentPreprocessor, LogseqContentPreprocessorProxy} from "./LogseqContentPreprocessor";
import pMemoize, {pMemoizeClear} from "p-memoize";
import objectHashOptimized from "../utils/objectHashOptimized";
import {LogseqProxy} from "./LogseqProxy";
import {PluginSettings} from "../settings";
import {WindowParentBridge} from "./WindowParentBridge";
import {LogseqPropertiesHelper} from "./LogseqPropertiesHelper";

const mldocsOptions = {
    toc: false,
    heading_number: false,
    keep_line_break: false,
    format: "Markdown",
    heading_to_list: false,
    exporting_keep_properties: false,
    inline_type_with_pos: true,
    parse_outline_only: false,
    export_md_remove_options: [],
    hiccup_in_block: true,
};

export interface HTMLFile {
    html: string;
    assets: Set<string>;
    tags: Set<string> | Array<string>;
}

/**
 * Base class for converting Logseq content to HTML for Anki cards.
 */
export class LogseqToHtmlConverter {
    /**
     * Main conversion method: converts Logseq content to HTML.
     */
    static async convertToHTMLFile(
        content: string,
        format = "markdown",
        opts: { processRefEmbeds?: boolean; displayTags?: boolean } = { processRefEmbeds: true, displayTags: false }
    ): Promise<HTMLFile> {
        let resultContent = content.trim(),
            resultAssets = new Set<string>(),
            resultTags = new Set<string>();
        const settings = this.getPluginSettings() as any;
        const debug = settings?.debug;
        if (debug?.includes("LogseqToHtmlConverter.ts"))
            console.log("--Start Converting--\nOriginal:", resultContent);

        // Preprocess content to normalize format (DB/MD/Org -> internal format)
        const preprocessResult = await this.preprocess(
            resultContent,
            format as "markdown" | "org"
        );
        resultContent = preprocessResult.content;
        const block_props = preprocessResult.properties;
        
        if (debug?.includes("LogseqToHtmlConverter.ts"))
            console.log("After preprocessing:", resultContent);

        if (format == "org") {
            mldocsOptions.format = "Org";
        } else mldocsOptions.format = "Markdown";

        // --- Hacky fix for inline html support and {{c\d+:: content}} marcos using hashmap ---
        const hashmap = {};

        // Put all anki cloze marcos in hashmap
        resultContent = resultContent.replace(ANKI_CLOZE_REGEXP, (match, g1, g2, g3, ...arg) => {
            const strFront = getRandomUnicodeString() + " "; // fix: #104
            const strBack = getRandomUnicodeString();

            // TODO: fix the 3 hacks! First, find whether the cloze starts from the beginning of the line using index of and iterating backwards until '\n'. Then, apply these hacks accordingly.
            // bug fix: new line if cloze starts with code block
            const first_line = g3.split("\n").shift();
            if (first_line.match(/^(```|~~~)/)) g3 = `\n${g3}`;

            // bug fix: cloze end charecters }} getting deleted after code / org block ends. Hence, add newline after them.
            const last_line = g3.split("\n").pop();
            if (last_line.match(/^(```|~~~)/) || last_line.match(/^#\+/)) g3 = `${g3}\n`;

            // fix: if there is a newline before cloze, we need to add new line after hash charecters of math block and org blocks
            const charecter_before_match = resultContent.substring(
                resultContent.indexOf(match) - 1,
                resultContent.indexOf(match),
            );
            if (
                (charecter_before_match == "\n" || charecter_before_match == "") &&
                (g3.match(/^\s*?\$\$/g) || g3.match(/^\s*?#\+/g))
            )
                g3 = `\n${g3}`;
            hashmap[strFront] = g1;
            hashmap[strFront.trim()] = g1; // fix: sometimes the end space of hash gets removed
            hashmap[strBack] = "}}";
            return `${strFront}${g3}${strBack}`;
        });

        // Put all html content in hashmap
        let parsedJson = Mldoc.parseInlineJson(
            resultContent,
            JSON.stringify({...mldocsOptions, parse_outline_only: true}),
            JSON.stringify({}),
        );
        try {
            parsedJson = JSON.parse(parsedJson);
        } catch {
            parsedJson = [];
        }
        let resultUTF8: Uint8Array = new TextEncoder().encode(resultContent);
        for (let i = parsedJson.length - 1; i >= 0; i--) {
            const node = parsedJson[i];
            if (node[node.length - 1]["start_pos"] == null) continue;
            if (node[0][0] == null) continue;

            const type = node[0][0];
            const start_pos = node[node.length - 1]["start_pos"];
            const end_pos = node[node.length - 1]["end_pos"];
            switch (type) {
                case "Raw_Html":
                case "Inline_Html":
                    resultUTF8 = await this.processInlineHTML(
                        node, start_pos, end_pos, resultContent, resultAssets, resultUTF8, hashmap
                    );
                    break;
                case "Raw_Hiccup":
                case "Inline_Hiccup":
                    resultUTF8 = await this.processInlineHiccup(
                        node, start_pos, end_pos, resultContent, resultUTF8, hashmap
                    );
                    break;
                case "Link":
                    resultUTF8 = await this.processLink(
                        node, start_pos, end_pos, resultContent, resultAssets, resultUTF8, hashmap, format
                    );
                    break;
            }
        }
        resultContent = new TextDecoder().decode(resultUTF8);
        if (debug?.includes("LogseqToHtmlConverter.ts"))
            console.log("After replacing errorinous terms:", resultContent);

        // Process the block & page refs + embeds
        if (opts.processRefEmbeds)
            resultContent = await this.processRefEmbeds(
                resultContent, resultAssets, resultTags, hashmap, format
            );
        else 
            resultContent = await this.hideRefEmbeds(resultContent, resultAssets, hashmap, format);

        // Render the markdown
        resultContent = Mldoc.export(
            "html",
            resultContent,
            JSON.stringify(mldocsOptions),
            JSON.stringify({}),
        );
        
        // Render images and codes
        const $ = cheerio.load(resultContent, {decodeEntities: false});
        $("pre code").each(function (i, elm) {
            $(elm).addClass("hljs");
            try {
                if (elm.attribs["data-lang"]) {
                    $(elm).html(
                        hljs.highlight(elm.attribs["data-lang"], $(elm).text())
                            .value.replace(/\n$/, "").replace(/::/g, '<span>&#58;</span><span>&#58;</span>')
                    );
                } else {
                    $(elm).html(
                        hljs.highlightAuto($(elm).html())
                            .value.replace(/\n$/, "").replace(/::/g, '<span>&#58;</span><span>&#58;</span>')
                    );
                }
            } catch (e) {
                console.warn(e);
            }
        });
        
        $("img").each(function (i, elm) {
            console.warn("Error: Image Found! Image should have been processed by processLink already and be hidden from cheerio.");
        });
        
        const $tagElems = $("a.tag");
        if ($tagElems.length > 0) {
            const graphName = (await this.getCurrentGraph())?.name;
            $tagElems.each(function (i, elm) {
                let tagName = $(elm).text(), afterText = "";
                if (tagName.match(/\[\[(.*?)\]\]/)) tagName = tagName.match(/\[\[(.*?)\]\]/)[1];
                if (tagName.match(new RegExp(`.*?([${specialChars}]+)`, ""))) {
                    afterText = tagName.match(new RegExp(`.*?([${specialChars}]+)`, ""))[1];
                    tagName = tagName.replace(new RegExp(`([${specialChars}]+)$`, ""), "");
                }
                resultTags.add(tagName);
                $(elm).replaceWith(
                    `<a class="tag" data-ref="${tagName}" href="logseq://graph/${encodeURIComponent(graphName)}?page=${encodeURIComponent(tagName)}">${opts.displayTags ? `#${tagName}` : ''}</a>${afterText}`
                );
            });
        }

        $(".mathblock, .latex-environment").each(function (i, elm) {
            let math = $(elm).html();
            math = math.replace(ORG_MATH_BLOCK_REGEXP, "$1");
            math = math.replace(MD_MATH_BLOCK_REGEXP, "$1");
            $(elm).html(`\\[ ${math} \\]`);
        });
        
        $("p").each(function (i, elm) {
            $(elm).replaceWith(`<span>${$(elm).html()}</span>`);
        });
        
        $("div.important, div.caution, div.pinned, div.tip, div.note, div.warning").each(function (i, elm) {
            $(elm).html(`<div style="display: revert">${$(elm).html()}</div>`);
        });
        
        if (block_props["background-color"]) {
            $("span:first-child").addClass(`block-highlight-${block_props["background-color"]}`);
        }
        
        resultContent = decodeHTMLEntities(decodeHTMLEntities($("#content ul li").html() || ""));
        if (debug?.includes("LogseqToHtmlConverter.ts"))
            console.log("After Mldoc.export:", resultContent);

        // Bring back inline html content and clozes from hashmap
        for (const key in hashmap) resultContent = safeReplace(resultContent, key, hashmap[key]);
        for (const key in hashmap) resultContent = safeReplace(resultContent, key, hashmap[key]);

        if (debug?.includes("LogseqToHtmlConverter.ts"))
            console.log("After bringing back errorinous terms:", resultContent, "\n---End---");
        
        return {html: resultContent, assets: resultAssets, tags: resultTags};
    }

    /**
     * Process block and page references/embeds
     */
    private static async processRefEmbeds(
        resultContent: string,
        resultAssets: Set<string>,
        resultTags: Set<string>,
        hashmap: Record<string, string>,
        format: string,
    ): Promise<string> {
        let block;
        resultContent = await safeReplaceAsync(
            resultContent,
            LOGSEQ_EMBDED_BLOCK_REGEXP,
            async (match, g1) => {
                const getBlockEmbedContentHTML = async (children: any, level = 0): Promise<string> => {
                    if (level >= 100) return "";
                    if (!Array.isArray(children) || children.length === 0) return "";
                    let result = `\n<ul class="children-list">`;
                    for (const child of children) {
                        result += `\n<li class="children ${child?.properties?.['logseq.orderListType'] === "number" ? 'numbered' : ''}">`;
                        const block_content = escapeClozesAndMacroDelimiters(child?.content) || "";
                        const format = child?.format || "markdown";
                        const blockContentHTMLFile = await this.convertToHTMLFile(block_content, format);
                        blockContentHTMLFile.assets.forEach((element) => {
                            resultAssets.add(element);
                        });
                        if (child.children && child.children.length > 0)
                            blockContentHTMLFile.html += await getBlockEmbedContentHTML(child.children, level + 1);
                        result += blockContentHTMLFile.html;
                        result += `</li>`;
                    }
                    result += `</ul>`;
                    return result;
                };

                try {
                    block = await this.getBlock(g1, {includeChildren: true});
                } catch (e) {
                    console.warn(e);
                }
                const str = getRandomUnicodeString();
                hashmap[str] = `<div class="embed-block">${block ? await getBlockEmbedContentHTML([block]) : ""}</div>`;
                return str;
            },
        );

        resultContent = await safeReplaceAsync(
            resultContent,
            LOGSEQ_EMBDED_PAGE_REGEXP,
            async (match, pageIdStr) => {
                const pageId = safeParseInt(pageIdStr);
                let pageTree = [];
                const pageName = await this.getPageNameFromID(pageId);

                const getPageContentHTML = async (children: any, level = 0): Promise<string> => {
                    if (level >= 100) return "";
                    if (!Array.isArray(children) || children.length === 0) return "";
                    let result = `\n<ul class="children-list">`;
                    for (const child of children) {
                        result += `\n<li class="children ${child?.properties?.['logseq.orderListType'] === "number" ? 'numbered' : ''}">`;
                        const block_content = escapeClozesAndMacroDelimiters(child?.content) || "";
                        const format = child?.format || "markdown";
                        const blockContentHTMLFile = await this.convertToHTMLFile(block_content, format);
                        blockContentHTMLFile.assets.forEach((element) => {
                            resultAssets.add(element);
                        });
                        if (child.children && child.children.length > 0) {
                            blockContentHTMLFile.html += await getPageContentHTML(child.children, level + 1);
                        }
                        result += blockContentHTMLFile.html;
                        result += `</li>`;
                    }
                    result += `</ul>`;
                    return result;
                };
                
                try {
                    pageTree = await this.getPageBlocksTree(pageId);
                } catch (e) {
                    console.warn(e);
                }

                const str = getRandomUnicodeString();
                const graphName = (await this.getCurrentGraph())?.name;
                hashmap[str] = `<div class="embed-page"><a href="logseq://graph/${encodeURIComponent(graphName)}?page=${encodeURIComponent(pageName)}" class="embed-header">${pageName}</a>${await getPageContentHTML(pageTree)}</div>`;
                return str;
            },
        );

        resultContent = await safeReplaceAsync(
            resultContent,
            LOGSEQ_RENAMED_PAGE_REF_REGEXP,
            async (match, aliasContent, pageIdStr) => {
                const pageId = safeParseInt(pageIdStr);
                const pageName = await this.getPageNameFromID(pageId);
                const str = getRandomUnicodeString();
                const graphName = (await this.getCurrentGraph())?.name;
                hashmap[str] = `<a href="logseq://graph/${encodeURIComponent(graphName)}?page=${encodeURIComponent(pageName)}" class="page-reference">${aliasContent}</a>`;
                return str;
            },
        );

        resultContent = await safeReplaceAsync(
            resultContent,
            LOGSEQ_PAGE_REF_REGEXP,
            async (match, pageIdStr: string) => {
                const str = getRandomUnicodeString();
                const graphName = (await this.getCurrentGraph())?.name;
                
                // Handle as page reference
                const pageId = safeParseInt(pageIdStr);
                const displayName = await this.getPageNameFromID(pageId);
                hashmap[str] = `<a href="logseq://graph/${encodeURIComponent(graphName)}?page=${encodeURIComponent(displayName)}" class="page-reference">${displayName}</a>`;
                return str;
            },
        );

        resultContent = await safeReplaceAsync(
            resultContent,
            LOGSEQ_RENAMED_BLOCK_REF_REGEXP,
            async (match, aliasContent, blockUUID) => {
                const str = getRandomUnicodeString();
                const graphName = (await this.getCurrentGraph())?.name;
                hashmap[str] = `<a href="logseq://graph/${encodeURIComponent(graphName)}?block-id=${encodeURIComponent(blockUUID)}" class="block-ref">${aliasContent}</a>`;
                return str;
            },
        );

        resultContent = await safeReplaceAsync(
            resultContent,
            LOGSEQ_BLOCK_REF_REGEXP,
            async (match, blockUUID) => {
                const str = getRandomUnicodeString();
                try {
                    const block = await this.getBlock(blockUUID);
                    if (!block || !block.uuid) throw new Error("Block not found: " + blockUUID);
                    let preprocessResult = await this.preprocess(block?.content || "", block?.format || "markdown");
                    let block_content = preprocessResult.content;
                    let block_props = preprocessResult.properties || {};
                    let block_content_first_line = getFirstNonEmptyLine(block_content).trim();
                    block_content_first_line = escapeClozesAndMacroDelimiters(block_content_first_line);
                    
                    let blockRef_content = block_content_first_line;
                    for (const [prop, value] of Object.entries(block_props))
                        blockRef_content += `\n${prop}:: ${value}`;
                    
                    const blockRefHTMLFile = await this.convertToHTMLFile(blockRef_content, block?.format);
                    blockRefHTMLFile.assets.forEach((element) => {
                        resultAssets.add(element);
                    });
                    const graphName = (await this.getCurrentGraph())?.name;
                    hashmap[str] = `<span onclick="window.open('logseq://graph/${encodeURIComponent(graphName)}?block-id=${encodeURIComponent(blockUUID)}')" class="block-ref">${blockRefHTMLFile.html}</span>`;
                } catch (e) {
                    console.warn(e);
                    hashmap[str] = `<span class="failed-block-ref">${blockUUID}</span>`;
                }
                return str;
            },
        );

        return resultContent;
    }

    /**
     * Hide references and embeds (don't expand them)
     */
    private static async hideRefEmbeds(
        resultContent: string,
        resultAssets: Set<string>,
        hashmap: Record<string, string>,
        format: string
    ): Promise<string> {
        resultContent = await safeReplaceAsync(
            resultContent,
            LOGSEQ_BLOCK_REF_REGEXP,
            async (match, blockUUID) => {
                const str = getRandomUnicodeString();
                hashmap[str] = match;
                return str;
            },
        );
        
        resultContent = await safeReplaceAsync(
            resultContent,
            LOGSEQ_PAGE_REF_REGEXP,
            async (match, pageIdStr) => {
                const pageId = safeParseInt(pageIdStr);
                const displayName = await this.getPageNameFromID(pageId);
                const str = getRandomUnicodeString();
                hashmap[str] = `<a class="page-reference">${displayName}</a>`;
                return str;
            },
        );
        
        return resultContent;
    }

    /**
     * Process inline HTML
     */
    private static async processInlineHTML(
        node: any,
        start_pos: number,
        end_pos: number,
        resultContent: string,
        resultAssets: Set<string>,
        resultUTF8: Uint8Array,
        hashmap: Record<string, string>,
    ): Promise<Uint8Array> {
        const content = new TextDecoder().decode(resultUTF8.slice(start_pos, end_pos));
        if (content != node[0][1]) {
            console.error("Error: content mismatch html", content, resultContent.substring(start_pos, end_pos));
        }
        const str = getRandomUnicodeString();
        hashmap[str] = content;
        return new Uint8Array([
            ...resultUTF8.subarray(0, start_pos),
            ...new TextEncoder().encode(str),
            ...resultUTF8.subarray(end_pos),
        ]);
    }

    /**
     * Process inline Hiccup
     */
    private static async processInlineHiccup(
        node: any,
        start_pos: number,
        end_pos: number,
        resultContent: string,
        resultUTF8: Uint8Array,
        hashmap: Record<string, string>,
    ): Promise<Uint8Array> {
        const content = new TextDecoder().decode(resultUTF8.slice(start_pos, end_pos));
        if (content != node[0][1]) {
            console.error("Error: content mismatch hiccup", content, resultContent.substring(start_pos, end_pos));
        }
        const str = getRandomUnicodeString();
        hashmap[str] = hiccupConverter.serialize(edn.decode(content));
        return new Uint8Array([
            ...resultUTF8.subarray(0, start_pos),
            ...new TextEncoder().encode(str),
            ...resultUTF8.subarray(end_pos),
        ]);
    }

    /**
     * Process links (images, audio, video, etc.)
     */
    private static async processLink(
        node: any,
        start_pos: number,
        end_pos: number,
        resultContent: string,
        resultAssets: Set<string>,
        resultUTF8: Uint8Array,
        hashmap: Record<string, string>,
        format: string,
    ): Promise<Uint8Array> {
        const content = new TextDecoder().decode(resultUTF8.slice(start_pos, end_pos));
        const link_type = node[0][1]?.url?.[0];
        const link_url = node[0][1]?.url?.[1];
        let metadata;
        try {
            metadata = await edn.decode(node[0][1].metadata);
        } catch (e) {
            console.warn(e);
        }
        const link_full_text = node[0][1]?.full_text;
        const link_label_type = node[0][1]?.label?.[0]?.[0];
        const link_label_text = node[0][1]?.label?.[0]?.[1];

        // Image Display
        if (link_type == "Search" && link_url.match(isImage_REGEXP) && !content.match(isWebURL_REGEXP) && link_full_text.startsWith("!")) {
            const str = getRandomUnicodeString();
            hashmap[str] = `<img src="${path.basename(link_url).split("?")[0]}" ${link_label_text ? `alt="${link_label_text}"` : ``} ${metadata && metadata.width ? `width="${metadata.width}"` : ``} ${metadata && metadata.height ? `height="${metadata.height}"` : ``}/>`;
            resultAssets.add(link_url.split("?")[0]);
            return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]);
        }
        if (link_type == "Complex" && link_url.link.match(isImage_REGEXP) && (format == "org" || link_full_text.match(MD_IMAGE_EMBEDED_REGEXP))) {
            const str = getRandomUnicodeString();
            hashmap[str] = `<img src="${link_url.protocol}://${link_url.link.split("?")[0]}" ${link_label_text ? `alt="${link_label_text}"` : ``} ${metadata && metadata.width ? `width="${metadata.width}"` : ``} ${metadata && metadata.height ? `height="${metadata.height}"` : ``}/>`;
            return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]);
        }
        if (format == "org" && link_type == "Page_ref" && link_url.match(isImage_REGEXP) && !link_url.match(isWebURL_REGEXP)) {
            const str = getRandomUnicodeString();
            hashmap[str] = `<img src="${path.basename(link_url).split("?")[0]}" />`;
            resultAssets.add(link_url.split("?")[0]);
            return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]);
        }

        // Audio Display
        if (link_type == "Search" && link_url.match(isAudio_REGEXP) && !content.match(isWebURL_REGEXP) && link_full_text.startsWith("!")) {
            const str = getRandomUnicodeString();
            hashmap[str] = `[sound:${path.basename(link_url).split("?")[0]}]`;
            resultAssets.add(link_url.split("?")[0]);
            return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]);
        }
        if (link_type == "Complex" && link_url.link.match(isAudio_REGEXP) && (format == "org" || link_full_text.match(MD_IMAGE_EMBEDED_REGEXP))) {
            const str = getRandomUnicodeString();
            hashmap[str] = `[sound:${link_url.protocol}://${link_url.link.split("?")[0]}]`;
            return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]);
        }
        if (format == "org" && link_type == "Page_ref" && link_url.match(isAudio_REGEXP) && !link_url.match(isWebURL_REGEXP)) {
            const str = getRandomUnicodeString();
            hashmap[str] = `[sound:${path.basename(link_url).split("?")[0]}]`;
            resultAssets.add(link_url.split("?")[0]);
            return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]);
        }

        // Video Display
        if (link_type == "Search" && link_url.match(isVideo_REGEXP) && !content.match(isWebURL_REGEXP) && link_full_text.startsWith("!")) {
            const str = getRandomUnicodeString();
            hashmap[str] = `<video src="${path.basename(link_url).split("?")[0]}" controlsList="nodownload" controls></video>`;
            resultAssets.add(link_url.split("?")[0]);
            return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]);
        }
        if (link_type == "Complex" && link_url.link.match(isVideo_REGEXP) && (format == "org" || link_full_text.match(MD_IMAGE_EMBEDED_REGEXP))) {
            const str = getRandomUnicodeString();
            hashmap[str] = `<video src="${link_url.protocol}://${link_url.link.split("?")[0]}" controlsList="nodownload" controls></video>`;
            return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]);
        }
        if (format == "org" && link_type == "Page_ref" && link_url.match(isVideo_REGEXP) && !link_url.match(isWebURL_REGEXP)) {
            const str = getRandomUnicodeString();
            hashmap[str] = `<video src="${path.basename(link_url).split("?")[0]}" controlsList="nodownload" controls></video>`;
            resultAssets.add(link_url.split("?")[0]);
            return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]);
        }

        // Fix #74
        if (link_type == "Complex" && link_url.protocol && link_label_type == "Plain") {
            const str = getRandomUnicodeString();
            hashmap[str] = `<a href="${link_url.protocol}://${link_url.link}">${link_label_text}</a>`;
            return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]);
        }

        return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(content), ...resultUTF8.subarray(end_pos)]);
    }

    /**
     * Helper to get page name from ID
     */
    private static async getPageNameFromID(pageId: number | string): Promise<string> {
        try {
            const numericPageId = safeParseInt(pageId);
            const page = await this.getPage(numericPageId);
            if (page) {
                return getNameFromPage(page) || String(pageId);
            }
        } catch (e) {}
        return String(pageId);
    }

    /**
     * Protected methods that can be overridden in proxy class for caching.
     */
    protected static async preprocess(content: string, format: "markdown" | "org") {
        return await LogseqContentPreprocessor.preprocess(content, format);
    }

    protected static async getCurrentGraph() {
        return await logseq.App.getCurrentGraph();
    }

    protected static async checkCurrentIsDbGraph() {
        try {
            return await logseq.App.checkCurrentIsDbGraph() as boolean;
        } catch {
            return false;
        }
    }

    protected static async getBlock(srcBlock: string, opts?: any) {
        return await LogseqPropertiesHelper.getBlock(srcBlock, opts);
    }

    protected static async getPage(srcPage: any) {
        return await LogseqPropertiesHelper.getPage(srcPage);
    }

    protected static async getPageBlocksTree(srcPage: any) {
        return await LogseqPropertiesHelper.getPageBlocksTree(srcPage);
    }

    protected static getPluginSettings() {
        return logseq.settings as PluginSettings;
    }
}

/**
 * Proxy version that uses cached LogseqProxy methods and LogseqContentPreprocessorProxy.
 * Use this during sync operations where caching is beneficial.
 */
export class LogseqToHtmlConverterProxy extends LogseqToHtmlConverter {
    /**
     * Override preprocess to use the proxy version
     */
    protected static async preprocess(content: string, format: "markdown" | "org") {
        return await LogseqContentPreprocessorProxy.preprocess(content, format);
    }

    protected static async getCurrentGraph() {
        return await LogseqProxy.App.getCurrentGraph();
    }

    protected static async checkCurrentIsDbGraph() {
        return Boolean(await LogseqProxy.App.checkCurrentIsDbGraph());
    }

    protected static async getBlock(srcBlock: string, opts?: any) {
        return await LogseqProxy.Editor.getBlock(srcBlock, opts);
    }

    protected static async getPage(srcPage: any) {
        return await LogseqProxy.Editor.getPage(srcPage);
    }

    protected static async getPageBlocksTree(srcPage: any) {
        return await LogseqProxy.Editor.getPageBlocksTree(srcPage);
    }

    protected static getPluginSettings() {
        return LogseqProxy.Settings.getPluginSettings();
    }

    /**
     * Cached version of convertToHTMLFile with memoization.
     */
    static convertToHTMLFile = pMemoize(
        async (
            content: string,
            format = "markdown",
            opts: { processRefEmbeds?: boolean; displayTags?: boolean } = { processRefEmbeds: true, displayTags: false }
        ): Promise<HTMLFile> => {
            return await super.convertToHTMLFile.call(LogseqToHtmlConverterProxy, content, format, opts);
        },
        {cacheKey: (args) => objectHashOptimized(args)});
}

// Initialize cache clearing on sync complete
if (typeof window !== 'undefined') {
    WindowParentBridge.addEventListener("syncLogseqToAnkiComplete", () => {
        pMemoizeClear(LogseqToHtmlConverterProxy.convertToHTMLFile);
    });
}