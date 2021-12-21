import { decodeHTMLEntities } from './utils';
import hljs from "highlight.js";
import path from "path";
import * as AnkiConnect from './AnkiConnect';
import '@logseq/libs'
import * as cheerio from 'cheerio';
import { getRandomUnicodeString, safeReplace } from './utils';

export async function convertLogseqMarkuptoHtml(content) {
    let result = content;
    result = safeReplace(result, /^\s*(\w|-)*::.*\n/gm, ""); //Remove md properties
    result = safeReplace(result, /:PROPERTIES:\n((.|\n)*?):END:\n/gm, ""); //Remove org properties
    // TODO: Convert embeded page refs and block refs here.
    result = safeReplace(result, /\[\[(.*?)\]\]/gm, `<a href="#$1" class="page-reference">$1</a>`); // Convert page refs
    result = safeReplace(result, /\(\((.*?)\)\)/gm, `<a href="#$1" class="block-reference">$1</a>`); // Convert block refs

    result = result.replace(/(?<!\$)\$((?=[\S])(?=[^$])[\s\S]*?\S)\$/g, "\\( $1 \\)"); // Convert inline math
    result = result.replace(/\$\$([\s\S]*?)\$\$/g, "\\[ $1 \\]"); // Convert block math
    return result;
}

export async function convertMdtoHtml(content) {
    let result = content;

    // --- Hacky fix for inline html support and {{c\d+:: content}} marcos ---
    // Put all html content in a hashmap
    let hashmap = {};
    result = safeReplace(result, /(<((\w|-)*?)((.|\n)*?)>((.|\n)*?)<\/\2>)|(<((.|\n)*?)\/>)/ig, (match) => {
        let str = getRandomUnicodeString();
        hashmap[str] = match;
        return str;
    }); 
    result = safeReplace(result, /(\{\{c(\d+)::)((.|\n)*)\}\}/g, (match, g1, g2, g3, ...arg) => {
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
            "format": "Markdown",
            "heading_to_list": false,
            "exporting_keep_properties": false,
            "inline_type_with_pos": true,
            "export_md_remove_options": [],
            "hiccup_in_block": true
        }),
        JSON.stringify({})
    );

    // Render images and and codes
    const $ = cheerio.load(result, {decodeEntities: false});
    const dataLinkRegex = /^\s*data:([a-z]+\/[a-z]+(;[a-z-]+=[a-z-]+)?)?(;base64)?,[a-z0-9!$&',()*+,;=\-._~:@/?%\s]*\s*$/i;
    const isImage = /^.*\.(png|jpg|jpeg|bmp|tiff|gif|apng|svg|webp)$/i;
    const isWebURL = /^(https?:(\/\/)?(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:(\/\/)?(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;
    let graphPath = (await logseq.App.getCurrentGraph()).path;
    $('pre code').each(function(i, elm) { // Syntax hightlight block code (block codes are preceded by pre)
        $(elm).addClass("hljs");
        if(elm.attribs["data-lang"]) {
            $(elm).html(hljs.highlight(elm.attribs["data-lang"], $(elm).html()).value.replace(/\n$/, ""));
        } else $(elm).html(hljs.highlightAuto($(elm).html()).value.replace(/\n$/, ""));
    });
    $('img').each(function(i, elm) {
        if ((encodeURI(elm.attribs.src).match(isImage) && !encodeURI(elm.attribs.src).match(isWebURL))) {
            let imgPath = path.join(graphPath, elm.attribs.src.replace(/^(\.\.\/)+/, ""));
            AnkiConnect.storeMediaFileByPath(encodeURIComponent(elm.attribs.src), imgPath); // Flatten and save
            elm.attribs.src = encodeURIComponent(elm.attribs.src); // Flatten image and convert to markdown.
        }
        else elm.attribs.src = elm.attribs.src.replace(/^http(s?):\/?\/?/i, "http$1://");
    });
    result = $('#content ul li').html();

    // Bring back html content and clozes from hasmap
    for(let key in hashmap) {
        result = safeReplace(result, key, hashmap[key]);
    }

    return result;
}

export async function convertOrgtoHtml(content) {
    let result = content;
    // @ts-expect-error
    result = Mldoc.export("html", result,
        JSON.stringify({
            "toc": false,
            "heading_number": false,
            "keep_line_break": false,
            "format": "Org",
            "heading_to_list": false,
            "exporting_keep_properties": false,
            "inline_type_with_pos": true,
            "export_md_remove_options": [],
            "hiccup_in_block": true
        }),
        JSON.stringify({})
    );
    const $ = cheerio.load(result, {decodeEntities: false});
    const dataLinkRegex = /^\s*data:([a-z]+\/[a-z]+(;[a-z-]+=[a-z-]+)?)?(;base64)?,[a-z0-9!$&',()*+,;=\-._~:@/?%\s]*\s*$/i;
    const isImage = /^.*\.(png|jpg|jpeg|bmp|tiff|gif|apng|svg|webp)$/i;
    const isWebURL = /^(https?:(\/\/)?(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:(\/\/)?(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;
    let graphPath = (await logseq.App.getCurrentGraph()).path;
    $('pre code').each(function(i, elm) { // Syntax hightlight block code (block codes are preceded by pre)
        $(elm).addClass("hljs");
        if(elm.attribs["data-lang"]) {
            $(elm).html(hljs.highlight(elm.attribs["data-lang"], $(elm).html()).value.replace(/\n$/, ""));
        } else $(elm).html(hljs.highlightAuto($(elm).html()).value.replace(/\n$/, ""));
    });
    $('img').each(function(i, elm) {
        if ((encodeURI(elm.attribs.src).match(isImage) && !encodeURI(elm.attribs.src).match(isWebURL))) {
            let imgPath = path.join(graphPath, elm.attribs.src.replace(/^(\.\.\/)+/, ""));
            AnkiConnect.storeMediaFileByPath(encodeURIComponent(elm.attribs.src), imgPath); // Flatten and save
            elm.attribs.src = encodeURIComponent(elm.attribs.src); // Flatten image and convert to markdown.
        }
        else elm.attribs.src = elm.attribs.src.replace(/^http(s?):\/?\/?/i, "http$1://");
    });
    result = $('#content ul li').html(); 
    return result;
}

export async function convertToHtml(content: string, format: string = "markdown"): Promise<string> {
    let result = content;

    result = await convertLogseqMarkuptoHtml(result);
    if (format == "markdown" || format == "md") {
        result = await convertMdtoHtml(result);
    } else if (format == "org") {
        result = await convertOrgtoHtml(result);
    };

    console.log(content, result);
    return result;
}