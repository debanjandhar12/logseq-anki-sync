import hljs from "highlight.js";
import path from "path";
import * as AnkiConnect from './AnkiConnect';
import '@logseq/libs';
import * as cheerio from 'cheerio';
import { decodeHTMLEntities, getRandomUnicodeString, safeReplace, safeReplaceAsync } from './utils';
import _ from 'lodash';

const debug = false;

export async function convertLogseqMarkuptoHtml(content: string, format: string = "markdown"): Promise<string> {
    let result = content;
    result = safeReplace(result, /^\s*(\w|-)*::.*\n?\n?/gm, ""); //Remove md properties
    result = safeReplace(result, /:PROPERTIES:\n((.|\n)*?):END:\n?/gm, ""); //Remove org properties
    
    result = await safeReplaceAsync(result, /\{\{embed \(\((.*?)\)\) *?\}\}/gm, async (match, g1) => {  // Convert block embed
        let block_content = "";
        try { let block = await logseq.Editor.getBlock(g1); block_content = _.get(block,"content").replace(/(\{\{c(\d+)::)((.|\n)*?)\}\}/g, "$3").replace(/(?<!{{embed [^}\n]*?)}}/g, "} } ") || ""; } catch (e) { console.warn(e); }
        return `<div class="embed-block">
                <ul class="children-list"><li class="children">${await convertToHtml(block_content, format)}</li></ul>
                </div>`;
    });
    result = await safeReplaceAsync(result, /\{\{embed \[\[(.*?)\]\] *?\}\}/gm, async (match, g1) => { // Convert page embed
        let pageTree = [];
        let getPageContentHTML = async (children: any, level: number = 0) => {
            if(level >= 100) return "";
            let result = `\n<ul class="children-list">`;
            for (let child of children) {
                result += `\n<li class="children">`;
                let block_content = _.get(child,"content").replace(/(\{\{c(\d+)::)((.|\n)*?)\}\}/g, "$3").replace(/(?<!{{embed [^}\n]*?)}}/g, "} } ") || "";
                let format = _.get(child,"format") || "markdown";
                let html = await convertToHtml(block_content, format);
                if (child.children.length > 0) html += await getPageContentHTML(child.children, level + 1);

                result += html;
                result += `</li>`;
            }
            result += `</ul>`;
            return result;
        }
        try { pageTree = await logseq.Editor.getPageBlocksTree(g1); } catch (e) { console.warn(e); }
        
        return `<div class="embed-page">
                <a href="#${g1}" class="embed-header">${g1}</a>
                ${await getPageContentHTML(pageTree)}
                </div>`;
    });
    
    result = safeReplace(result, /\[\[(.*?)\]\]/gm, `<a href="#$1" class="page-reference">$1</a>`); // Convert page refs
    result = safeReplace(result, /\[(.*?)\]\(\(\((.*?)\)\)\)/gm, `<a href="#$2" class="block-reference">$1</a>`); // Convert block ref link
    result = await safeReplaceAsync(result, /\(\((.*?)\)\)/gm, async (match, g1) => { // Convert block refs
        let block_content = `${g1}`;
        try { let block = await logseq.Editor.getBlock(g1); block_content = _.get(block,"content").replace(/(\{\{c(\d+)::)((.|\n)*?)\}\}/g, "$3").replace(/(?<!{{embed [^}\n]*?)}}/g, "} } ") || ""; } catch (e) { console.warn(e); }
        block_content = safeReplace(block_content, /^\s*(\w|-)*::.*\n?\n?/gm, ""); 
        block_content = safeReplace(block_content, /:PROPERTIES:\n((.|\n)*?):END:\n?/gm, ""); 
        let block_content_first_line = block_content.split("\n").find(line => line.trim() != "");
        return `<a href="#${g1}" class="block-reference">${block_content_first_line}</a>`;
    });

    return result;
}

export async function convertToHtml(content: string, format: string = "markdown"): Promise<string> {
    let result = content;

    result = await convertLogseqMarkuptoHtml(result, format);
    let r = result;
    if (format == "markdown" || format == "md") {
        format = "Markdown";
    } else if (format == "org") {
        format = "Org";
    };

    let mldocsOptions = {
        "toc": false,
        "heading_number": false,
        "keep_line_break": false,
        "format": format,
        "heading_to_list": false,
        "exporting_keep_properties": false,
        "inline_type_with_pos": true,
        "export_md_remove_options": [],
        "hiccup_in_block": true
    };

    // --- Hacky fix for inline html support and {{c\d+:: content}} marcos using hashmap ---
    let hashmap = {};

    // Put all html content in hashmap
    // @ts-expect-error
    let parsedJson = Mldoc.parseInlineJson(result,
        JSON.stringify(mldocsOptions),
        JSON.stringify({})
    );
    try { parsedJson = JSON.parse(parsedJson) } catch {parsedJson = [];};
    for(let i = parsedJson.length-1; i >= 0; i--) {
        // node's start_pos is bound to be larger than next item's end_pos due to how Mldoc.parseInlineJson works
        let node = parsedJson[i];
        if(node[node.length-1]["start_pos"] == null) continue;
        if(node[0][0] == null) continue;

        let type = node[0][0];
        let content = node[0][1];
        let start_pos = node[node.length-1]["start_pos"];
        let end_pos = node[node.length-1]["end_pos"];
        if(type == "Raw_Html" || type == "Inline_Html") {
            if(content != result.substring(start_pos, end_pos)) {
                console.error("Error: content mismatch", content, result.substring(start_pos, end_pos));
            }
            let str = getRandomUnicodeString();
            hashmap[str] = result.substring(start_pos, end_pos);
            result = result.substring(0, start_pos) + str + result.substring(end_pos);    
        }
    }
    
    // Put all anki cloze marcos in hashmap
    result = result.replace(/(\{\{c(\d+)::)((.|\n)*?)\}\}/g, (match, g1, g2, g3, ...arg) => {
        let strFront = getRandomUnicodeString();
        let strBack = getRandomUnicodeString();

        // temportary fix: cloze end charecters }} getting deleted after code block ends
        if(g3.trim().endsWith("```")) {
            g3 = `${g3}\n`;
        }

        // fix: if there is a newline before cloze, we need to add new line after hash charecters
        let charecter_before_match = result.substring(result.indexOf(match)-1, result.indexOf(match));
        if((charecter_before_match == "\n" || charecter_before_match == "") && (g3.match(/^\s*?\$\$/g) || g3.match(/^\s*?#\+/g)))
            g3 = `\n${g3}`;
        hashmap[strFront] = g1;
        hashmap[strBack] = "}}";
        return `${strFront}${g3}${strBack}`;
    });
    let r2 = result;

    // Render the markdown
    // @ts-expect-error
    result = Mldoc.export("html", result,
        JSON.stringify(mldocsOptions),
        JSON.stringify({})
    );
    let r3 = result;
    // Render images and and codes
    let $ = cheerio.load(result, { decodeEntities: false });
    const isImage = /^.*\.(png|jpg|jpeg|bmp|tiff|gif|apng|svg|webp)$/i;
    const isWebURL = /^(https?:(\/\/)?(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:(\/\/)?(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;
    let graphPath = (await logseq.App.getCurrentGraph()).path;
    $('pre code').each(function (i, elm) { // Syntax hightlight block code (block codes are preceded by pre)
        $(elm).addClass("hljs");
        if (elm.attribs["data-lang"]) {
            $(elm).html(hljs.highlight(elm.attribs["data-lang"], $(elm).html()).value.replace(/\n$/, ""));
        } else $(elm).html(hljs.highlightAuto($(elm).html()).value.replace(/\n$/, ""));
    });
    $('img').each(function (i, elm) {   // Handle images
        if ((encodeURI(elm.attribs.src).match(isImage) && !encodeURI(elm.attribs.src).match(isWebURL))) {
            try {
                let imgPath = path.join(graphPath, path.resolve(elm.attribs.src));
                AnkiConnect.storeMediaFileByPath(encodeURIComponent(elm.attribs.src), imgPath); // Flatten image path and save in anki
            } catch (e) { console.warn(e); }
            elm.attribs.src = encodeURIComponent(elm.attribs.src); // Flatten image path
        }
        else elm.attribs.src = elm.attribs.src.replace(/^http(s?):\/?\/?/i, "http$1://"); // Fix web image path
    });
    $('.mathblock, .latex-environment').each(function (i, elm) {    // Handle org math and latex-environment blocks
        let math = $(elm).html();
        // Remove all types of math braces in math
        math = math.replace(/\\\[([\s\S]*?)\\\]/g, "$1");
        math = math.replace(/\$\$([\s\S]*?)\$\$/g, "$1");

        // Add block math braces in math
        $(elm).html(`\\[ ${math} \\]`);
    });
    result = decodeHTMLEntities(decodeHTMLEntities($('#content ul li').html() || ""));

    // Bring back inline html content and clozes from hashmap
    for (let key in hashmap) {
        result = safeReplace(result, key, hashmap[key]);
    }

    if(debug) console.log(content, r, hashmap, r2,"-----\n",r3,"-----\n", result);
    return result;
}