import hljs from "highlight.js";
import path from "path";
import * as AnkiConnect from './AnkiConnect';
import '@logseq/libs';
import * as cheerio from 'cheerio';
import { getRandomUnicodeString, safeReplace, safeReplaceAsync } from './utils';

export async function convertLogseqMarkuptoHtml(content: string, format: string = "markdown"): Promise<string> {
    let result = content;
    result = safeReplace(result, /^\s*(\w|-)*::.*\n?\n?/gm, ""); //Remove md properties
    result = safeReplace(result, /:PROPERTIES:\n((.|\n)*?):END:\n?/gm, ""); //Remove org properties
    
    // TODO: Convert embeded page refs here.
    result = await safeReplaceAsync(result, /\{\{embed \(\((.*?)\)\) *?\}\}/gm, async (match, g1) => {
        let block_content = "";
        try { block_content = (await logseq.Editor.getBlock(g1)).content; } catch (e) { console.log(e); }
        return `<div class="embed-block">
                <ul class="children-list"><li class="children">${await convertToHtml(block_content, format)}</li></ul>
                </div>`;
    });
    result = safeReplace(result, /\[\[(.*?)\]\]/gm, `<a href="#$1" class="page-reference">$1</a>`); // Convert page refs
    result = safeReplace(result, /\[(.*?)\]\(\(\((.*?)\)\)\)/gm, `<a href="#$2" class="block-reference">$1</a>`); // Convert block ref link
    result = safeReplace(result, /\(\((.*?)\)\)/gm, `<a href="#$1" class="block-reference">$1</a>`); // Convert block refs

    result = result.replace(/(?<!\$)\$((?=[\S])(?=[^$])[\s\S]*?\S)\$/g, "\\( $1 \\)"); // Convert inline math
    result = result.replace(/\$\$([\s\S]*?)\$\$/g, "\\[ $1 \\]"); // Convert block math
    return result;
}

export async function convertToHtml(content: string, format: string = "markdown"): Promise<string> {
    let result = content;

    result = await convertLogseqMarkuptoHtml(result, format);

    if (format == "markdown" || format == "md") {
        format = "Markdown";
    } else if (format == "org") {
        format = "Org";
    };

    let $ = cheerio.load(result, { decodeEntities: false });
    // --- Hacky fix for inline html support and {{c\d+:: content}} marcos using hashmap ---
    let hashmap = {};

    // Put all html content in hashmap
    $("body").children("*").each((i, el) => {
        if (el.type == "tag") {
            let str = getRandomUnicodeString();
            hashmap[str] = $.html(el);
            console.log("Hashmap", $(el), hashmap[str]);
            $(el).replaceWith(str);
        }
    });
    result = $("body").html();

    // Put all anki cloze marcos in hashmap
    result = safeReplace(result, /(\{\{c(\d+)::)((.|\n)*?)\}\}/g, (match, g1, g2, g3, ...arg) => {
        let strFront = getRandomUnicodeString();
        let strBack = getRandomUnicodeString();
        hashmap[strFront] = g1;
        hashmap[strBack] = "}}";
        return `${strFront}${g3}${strBack}`;
    });

    // Render the markdown
    // @ts-expect-error
    result = Mldoc.export("html", result,
        JSON.stringify({
            "toc": false,
            "heading_number": false,
            "keep_line_break": false,
            "format": format,
            "heading_to_list": false,
            "exporting_keep_properties": false,
            "inline_type_with_pos": true,
            "export_md_remove_options": [],
            "hiccup_in_block": true
        }),
        JSON.stringify({})
    );

    // Render images and and codes
    $ = cheerio.load(result, { decodeEntities: false });
    const isImage = /^.*\.(png|jpg|jpeg|bmp|tiff|gif|apng|svg|webp)$/i;
    const isWebURL = /^(https?:(\/\/)?(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:(\/\/)?(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;
    let graphPath = (await logseq.App.getCurrentGraph()).path;
    $('pre code').each(function (i, elm) { // Syntax hightlight block code (block codes are preceded by pre)
        $(elm).addClass("hljs");
        if (elm.attribs["data-lang"]) {
            $(elm).html(hljs.highlight(elm.attribs["data-lang"], $(elm).html()).value.replace(/\n$/, ""));
        } else $(elm).html(hljs.highlightAuto($(elm).html()).value.replace(/\n$/, ""));
    });
    $('img').each(function (i, elm) {
        if ((encodeURI(elm.attribs.src).match(isImage) && !encodeURI(elm.attribs.src).match(isWebURL))) {
            try {
                let imgPath = path.join(graphPath, elm.attribs.src.replace(/^(\.\.\/)+/, ""));
                AnkiConnect.storeMediaFileByPath(encodeURIComponent(elm.attribs.src), imgPath); // Flatten image path and save in anki
            } catch (e) { console.log(e); }
            elm.attribs.src = encodeURIComponent(elm.attribs.src); // Flatten image path
        }
        else elm.attribs.src = elm.attribs.src.replace(/^http(s?):\/?\/?/i, "http$1://"); // Fix web image path
    });
    result = $('#content ul li').html();

    // Bring back inline html content and clozes from hashmap
    for (let key in hashmap) {
        result = safeReplace(result, key, hashmap[key]);
    }

    console.log(content, hashmap, result);
    return result;
}