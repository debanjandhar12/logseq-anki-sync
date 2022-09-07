import hljs from "highlight.js";
import '@logseq/libs';
import * as cheerio from 'cheerio';
import { decodeHTMLEntities, escapeClozeAndSecoundBrace, getFirstNonEmptyLine, getRandomUnicodeString, safeReplace, safeReplaceAsync } from '../utils';
import _ from 'lodash';
import { Mldoc } from 'mldoc';
import { ANKI_CLOZE_REGEXP, LOGSEQ_BLOCK_REF_REGEXP, MD_IMAGE_EMBEDED_REGEXP, isImage_REGEXP, isWebURL_REGEXP, LOGSEQ_EMBDED_PAGE_REGEXP, LOGSEQ_EMBDED_BLOCK_REGEXP, LOGSEQ_PAGE_REF_REGEXP, LOGSEQ_RENAMED_BLOCK_REF_REGEXP, MD_MATH_BLOCK_REGEXP, MD_PROPERTIES_REGEXP, ORG_MATH_BLOCK_REGEXP, ORG_PROPERTIES_REGEXP } from "../constants";
import { LogseqProxy } from "../LogseqProxy";
import * as hiccupConverter from "@thi.ng/hiccup";
import { edn } from "@yellowdig/cljs-tools";

let mldocsOptions = {
    "toc": false,
    "heading_number": false,
    "keep_line_break": false,
    "format": "Markdown",
    "heading_to_list": false,
    "exporting_keep_properties": false,
    "inline_type_with_pos": true,
    "parse_outline_only": false,
    "export_md_remove_options": [],
    "hiccup_in_block": true
};

export interface HTMLFile {
    html: string;
    assets: Set<string>;
}

export let convertToHTMLFileCache = new Map<{content: string, format: string}, HTMLFile>();

export async function convertToHTMLFile(content: string, format: string = "markdown"): Promise<HTMLFile> {
    if(convertToHTMLFileCache.has({content, format})) return convertToHTMLFileCache.get({content, format});
    let resultContent = content, resultAssets = new Set<string>();
    if (logseq.settings.debug.includes("Converter.ts")) console.log("--Start Converting--\nOriginal:", resultContent);

    ({html: resultContent, assets: resultAssets} = await processProperties({html:  resultContent, assets: resultAssets}, format));
    ({html: resultContent, assets: resultAssets} = await processEmbeds({html:  resultContent, assets: resultAssets}, format));
    if (logseq.settings.debug.includes("Converter.ts")) console.log("After processing embeded:", resultContent);

    if (format == "org") {
        mldocsOptions.format = "Org";
    } else mldocsOptions.format = "Markdown";

    // --- Hacky fix for inline html support and {{c\d+:: content}} marcos using hashmap ---
    let hashmap = {};

    // Put all html content in hashmap
    let parsedJson = Mldoc.parseInlineJson(resultContent,
        JSON.stringify({...mldocsOptions, "parse_outline_only": true}),
        JSON.stringify({})
    );
    try { parsedJson = JSON.parse(parsedJson); } catch { parsedJson = []; };
    let resultUTF8 = new TextEncoder().encode(resultContent);  // Convert to utf8 array as mldocs outputs position according to utf8 https://github.com/logseq/mldoc/issues/120
    for (let i = parsedJson.length - 1; i >= 0; i--) {
        // node's start_pos is bound to be larger than next item's end_pos due to how Mldoc.parseInlineJson works
        let node = parsedJson[i];
        if (node[node.length - 1]["start_pos"] == null) continue;
        if (node[0][0] == null) continue;

        let type = node[0][0];
        let start_pos = node[node.length - 1]["start_pos"];
        let end_pos = node[node.length - 1]["end_pos"];
        switch (type) {
            case "Raw_Html": case "Inline_Html":
                resultUTF8 = await processInlineHTML(node, start_pos, end_pos, resultContent, resultAssets, resultUTF8, hashmap);
            break;
            case "Raw_Hiccup": case "Inline_Hiccup":
                resultUTF8 = await processInlineHiccup(node, start_pos, end_pos, resultContent, resultUTF8, hashmap);
            break;
            case "Link":
                resultUTF8 =  await processLink(node, start_pos, end_pos, resultContent, resultAssets, resultUTF8, hashmap, format);
            break;
        }
    }
    resultContent = new TextDecoder().decode(resultUTF8);

    // Put all anki cloze marcos in hashmap
    resultContent = resultContent.replace(ANKI_CLOZE_REGEXP, (match, g1, g2, g3, ...arg) => {
        let strFront = getRandomUnicodeString();
        let strBack = getRandomUnicodeString();

        // bug fix: cloze end charecters }} getting deleted after code block ends. Hence, add newline after cloze content.
        let last_line = g3.split("\n").pop();
        if (last_line.match(/^```/)) {
            g3 = `${g3}\n`;
        }

        // fix: if there is a newline before cloze, we need to add new line after hash charecters of math block and org blocks
        let charecter_before_match = resultContent.substring(resultContent.indexOf(match) - 1, resultContent.indexOf(match));
        if ((charecter_before_match == "\n" || charecter_before_match == "") && (g3.match(/^\s*?\$\$/g) || g3.match(/^\s*?#\+/g)))
            g3 = `\n${g3}`;
        hashmap[strFront] = g1;
        hashmap[strBack] = "}}";
        return `${strFront}${g3}${strBack}`;
    });
    if (logseq.settings.debug.includes("Converter.ts")) console.log("After replacing errorinous terms:", resultContent);

    // Render the markdown
    resultContent = Mldoc.export("html", resultContent,
        JSON.stringify(mldocsOptions),
        JSON.stringify({})
    );
    // Render images and and codes
    let $ = cheerio.load(resultContent, { decodeEntities: false });
    $('pre code').each(function (i, elm) { // Syntax hightlight block code (block codes are preceded by pre)
        $(elm).addClass("hljs");
        if (elm.attribs["data-lang"]) {
            $(elm).html(hljs.highlight(elm.attribs["data-lang"], $(elm).html()).value.replace(/\n$/, ""));
        } else $(elm).html(hljs.highlightAuto($(elm).html()).value.replace(/\n$/, ""));
    });
    $('img').each(function (i, elm) {   // Handle images
        if ((encodeURI(elm.attribs.src).match(isImage_REGEXP) && !encodeURI(elm.attribs.src).match(isWebURL_REGEXP))) {
            resultAssets.add(elm.attribs.src);
            elm.attribs.src = encodeURIComponent(elm.attribs.src); // Flatten image path
        }
        else elm.attribs.src = elm.attribs.src.replace(/^http(s?):\/?\/?/i, "http$1://"); // Fix web image path
    });
    $('.mathblock, .latex-environment').each(function (i, elm) {    // Handle org math and latex-environment blocks
        let math = $(elm).html();
        // Remove all types of math braces in math
        math = math.replace(ORG_MATH_BLOCK_REGEXP, "$1");
        math = math.replace(MD_MATH_BLOCK_REGEXP, "$1");

        // Add block math braces in math
        $(elm).html(`\\[ ${math} \\]`);
    });
    resultContent = decodeHTMLEntities(decodeHTMLEntities($('#content ul li').html() || ""));
    if (logseq.settings.debug.includes("Converter.ts")) console.log("After Mldoc.export:", resultContent);

    // Bring back inline html content and clozes from hashmap
    for (let key in hashmap) {
        resultContent = safeReplace(resultContent, key, hashmap[key]);
    }

    if (logseq.settings.debug.includes("Converter.ts")) console.log("After bringing back errorinous terms:", resultContent, "\n---End---");
    convertToHTMLFileCache.set({content, format}, {html: resultContent, assets: resultAssets});
    return {html: resultContent, assets: resultAssets};
}

async function processProperties(htmlFile: HTMLFile, format: string = "markdown"): Promise<HTMLFile> {
    let resultContent = htmlFile.html, resultAssets = htmlFile.assets;
    resultContent = safeReplace(resultContent, MD_PROPERTIES_REGEXP, ""); //Remove md properties
    resultContent = safeReplace(resultContent, ORG_PROPERTIES_REGEXP, ""); //Remove org properties
    return {html: resultContent, assets: resultAssets};
}

async function processEmbeds(htmlFile: HTMLFile, format: string = "markdown"): Promise<HTMLFile> {
    let resultContent = htmlFile.html, resultAssets = htmlFile.assets;

    resultContent = await safeReplaceAsync(resultContent, LOGSEQ_EMBDED_BLOCK_REGEXP, async (match, g1) => {  // Convert block embed
        let block_content = "";
        try { let block = await LogseqProxy.Editor.getBlock(g1); block_content = _.get(block, "content").replace(ANKI_CLOZE_REGEXP, "$3").replace(/(?<!{{embed [^}\n]*?)}}/g, "} } ") || ""; } catch (e) { console.warn(e); }
        return `<div class="embed-block">
                <ul class="children-list"><li class="children">
                ${await (async () => {
                    let blockContentHTMLFile : HTMLFile = await convertToHTMLFile(block_content, format);
                    blockContentHTMLFile.assets.forEach(element => {
                        resultAssets.add(element);
                    });
                    return blockContentHTMLFile.html;
                })()}
                </li></ul>
                </div>`;
    });

    resultContent = await safeReplaceAsync(resultContent, LOGSEQ_EMBDED_PAGE_REGEXP, async (match, pageName) => { // Convert page embed
        let pageTree = [];
        let getPageContentHTML = async (children: any, level: number = 0) : Promise<string> => {
            if (level >= 100) return "";
            let result = `\n<ul class="children-list">`;
            for (let child of children) {
                result += `\n<li class="children">`;
                let block_content = escapeClozeAndSecoundBrace(_.get(child, "content")) || "";
                let format = _.get(child, "format") || "markdown";
                let blockContentHTMLFile = await convertToHTMLFile(block_content, format);
                blockContentHTMLFile.assets.forEach(element => {
                    resultAssets.add(element);
                });
                if (child.children.length > 0) blockContentHTMLFile.html += await getPageContentHTML(child.children, level + 1);

                result += blockContentHTMLFile.html;
                result += `</li>`;
            }
            result += `</ul>`;
            return result;
        }
        try { pageTree = await LogseqProxy.Editor.getPageBlocksTree(pageName); } catch (e) { console.warn(e); }

        return `<div class="embed-page">
                <a href="logseq://graph/${encodeURIComponent(_.get(await logseq.App.getCurrentGraph(), 'name'))}?page=${encodeURIComponent(pageName)}" class="embed-header">${pageName}</a>
                ${await getPageContentHTML(pageTree)}
                </div>`;
    });

    resultContent = await safeReplaceAsync(resultContent, LOGSEQ_PAGE_REF_REGEXP, async (match, pageName) => { // Convert page refs
        const isImage = /^.*\.(png|jpg|jpeg|bmp|tiff|gif|apng|svg|webp)$/i;
        const isWebURL = /^(https?:(\/\/)?(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:(\/\/)?(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;
        if(format == "org" && encodeURI(pageName).match(isImage)) {
            return `![](${pageName})`;
        }
        else if(format == "org" && encodeURI(pageName).match(isWebURL)) {
            return `${pageName}`;
        }
        return `<a href="logseq://graph/${encodeURIComponent(_.get(await logseq.App.getCurrentGraph(), 'name'))}?page=${encodeURIComponent(pageName)}" class="page-reference">${pageName}</a>`
    }); 
    resultContent = await safeReplaceAsync(resultContent, LOGSEQ_RENAMED_BLOCK_REF_REGEXP, async (match, aliasContent, blockUUID) => { // Convert page refs
        return `<a href="logseq://graph/${encodeURIComponent(_.get(await logseq.App.getCurrentGraph(), 'name'))}?block-id=${encodeURIComponent(blockUUID)}" class="block-ref">${aliasContent}</a>`
    }); // Convert block ref link
    resultContent = await safeReplaceAsync(resultContent, LOGSEQ_BLOCK_REF_REGEXP, async (match, blockUUID) => { // Convert block refs
        let block;
        try { block = await LogseqProxy.Editor.getBlock(blockUUID); }
        catch (e) { console.warn(e); }
        if (_.get(block, "properties.lsType") == "annotation" && _.get(block, "properties.hlType") == "area") {  // Pdf area ref
            let page = await LogseqProxy.Editor.getPage(block.page.id);
            let hls_img_loc = `../assets/${_.get(page, "originalName", "").replace("hls__", "")}/${_.get(block, "properties.hlPage")}_${blockUUID}_${_.get(block, "properties.hlStamp")}.png`;
            resultAssets.add(hls_img_loc);
            let img_html = `<img src="${encodeURIComponent(hls_img_loc)}" />`
            return `<a href="logseq://graph/${encodeURIComponent(_.get(await logseq.App.getCurrentGraph(), 'name'))}?block-id=${encodeURIComponent(blockUUID)}" class="block-ref">\ud83d\udccc<strong>P${_.get(block, "properties.hlPage")}</strong> <br/> ${img_html}</a>`;
        }
        else if (_.get(block, "properties.lsType") == "annotation") {    // Pdf text ref
            let block_content = escapeClozeAndSecoundBrace(_.get(block, "content"));
            block_content = safeReplace(block_content, MD_PROPERTIES_REGEXP, "");
            block_content = safeReplace(block_content, ORG_PROPERTIES_REGEXP, "");
            return `<a href="logseq://graph/${encodeURIComponent(_.get(await logseq.App.getCurrentGraph(), 'name'))}?block-id=${encodeURIComponent(blockUUID)}" class="block-ref">\ud83d\udccc<strong>P${_.get(block, "properties.hlPage")}</strong> ${block_content}</a>`;
        }
        // Normal Block ref
        try {
            let block_content = _.get(block, "content");
            block_content = safeReplace(block_content, MD_PROPERTIES_REGEXP, "");
            block_content = safeReplace(block_content, ORG_PROPERTIES_REGEXP, "");
            let block_content_first_line = getFirstNonEmptyLine(block_content).trim();
            block_content_first_line = escapeClozeAndSecoundBrace(block_content_first_line);
            return `<a href="logseq://graph/${encodeURIComponent(_.get(await logseq.App.getCurrentGraph(), 'name'))}?block-id=${encodeURIComponent(blockUUID)}" class="block-ref">${block_content_first_line}</a>`;
        }
        catch (e) { // Block not found
            console.warn(e);
            return `<a class="failed-block-ref">${blockUUID}</a>`;
        }
    });

    return {html: resultContent, assets: resultAssets};
}

async function processInlineHTML(node, start_pos, end_pos, resultContent, resultAssets, resultUTF8, hashmap) {
    let content = new TextDecoder().decode(resultUTF8.slice(start_pos, end_pos));
    if (content != node[0][1]) {
        console.error("Error: content mismatch html", content, resultContent.substring(start_pos, end_pos));
    }
    let str = getRandomUnicodeString();
    hashmap[str] = content;
    return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]);
}

async function processInlineHiccup(node, start_pos, end_pos, resultContent, resultUTF8, hashmap) {
    let content = new TextDecoder().decode(resultUTF8.slice(start_pos, end_pos));
    if (content != node[0][1]) {
        console.error("Error: content mismatch hiccup", content, resultContent.substring(start_pos, end_pos));
    }
    let str = getRandomUnicodeString();
    hashmap[str] = hiccupConverter.serialize(edn.decode(content));
    return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]);
}

async function processLink(node, start_pos, end_pos, resultContent, resultAssets, resultUTF8, hashmap, format) {
    let content = new TextDecoder().decode(resultUTF8.slice(start_pos, end_pos));
    let link_type = _.get(node[0][1], "url[0]");
    let link_url = _.get(node[0][1], "url[1]");
    let metadata;
    try { metadata = await edn.decode(node[0][1].metadata); } catch (e) { console.warn(e); }
    let link_full_text = _.get(node[0][1], "full_text");
    let blockRefLabel = _.get(node[0][1], "label[0][1]");
    if (link_type == "Search" && link_url.match(isImage_REGEXP) && !content.match(isWebURL_REGEXP)) {
        let str = getRandomUnicodeString();
        hashmap[str] = `<img src="${encodeURIComponent(link_url)}" ${blockRefLabel? `title="${blockRefLabel}"` : ``} ${metadata && metadata.width ? `width="${metadata.width}"` : ``} ${metadata && metadata.height ? `height="${metadata.height}"` : ``}/>`;
        resultAssets.add(link_url);
        return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]); 
    }
    else if (link_type == "Complex" && link_url.link.match(isImage_REGEXP) && (format == "org" || link_full_text.match(MD_IMAGE_EMBEDED_REGEXP))) {
        let str = getRandomUnicodeString();
        hashmap[str] = `<img src="${link_url.protocol}://${link_url.link}" ${blockRefLabel? `title="${blockRefLabel}"` : ``} ${metadata && metadata.width ? `width="${metadata.width}"` : ``} ${metadata && metadata.height ? `height="${metadata.height}"` : ``}/>`;
        return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]); 
    }
    else if (format == "org" && link_type == "Page_ref" && link_url.match(isImage_REGEXP) && !link_url.match(isWebURL_REGEXP)) {
        let str = getRandomUnicodeString();
        hashmap[str] = `<img src="${encodeURIComponent(link_url)}" />`;
        resultAssets.add(link_url);
        return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(str), ...resultUTF8.subarray(end_pos)]); 
    }
    return new Uint8Array([...resultUTF8.subarray(0, start_pos), ...new TextEncoder().encode(content), ...resultUTF8.subarray(end_pos)]);;
}