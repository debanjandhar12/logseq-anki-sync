import { decodeHTMLEntities } from './utils';
import { Remarkable } from 'remarkable';
import hljs from "highlight.js";
import path from "path";
import * as AnkiConnect from './AnkiConnect';

export async function convertLogseqMarkuptoHtml(content) {
    let result = content;
    result = result.replace(/^\s*(\w|-)*::.*/gm, "").replace(/:PROPERTIES:\n((.|\n)*?):END:/gm, "");  //Remove properties
    result = result.replace(/(?<!\$)\$((?=[\S])(?=[^$])[\s\S]*?\S)\$/g, "\\( $1 \\)"); // Convert inline math
    result = result.replace(/\$\$([\s\S]*?)\$\$/g, "\\[ $1 \\]"); // Convert block math
    result = result.replace(/#\+BEGIN_(INFO|PROOF)( .*)?\n((.|\n)*?)#\+END_\1/gi, function (match, g1, g2, g3) { // Remove proof, info org blocks
        return ``;
    });
    result = result.replace(/#\+BEGIN_(QUOTE)( .*)?\n((.|\n)*?)#\+END_\1/gi, function (match, g1, g2, g3) { // Convert quote org blocks
        return `<blockquote">${g3.trim()}</blockquote>`;
    });
    result = result.replace(/#\+BEGIN_(CENTER)( .*)?\n((.|\n)*?)#\+END_\1/gi, function (match, g1, g2, g3) { // Convert center org blocks
        return `<span class="text-center">${g3.trim()}</span>`; // div is buggy with remarkable
    });
    result = result.replace(/#\+BEGIN_(COMMENT)( .*)?\n((.|\n)*?)#\+END_\1/gi, function (match, g1, g2, g3) { // Remove comment org blocks
        return ``;
    });
    while (true) {  // Convert named org blocks recursively
        let oldres = result;
        result = result.replace(/#\+BEGIN_([^ \n]+)( .*)?\n((.|\n)*?)#\+END_\1/gi, function (match, g1, g2, g3) {
            return `<span class="${g1.toLowerCase()}">${g3.trim()}</span>`; // div is buggy with remarkable
        });
        if (oldres == result) break;
    }
    return result;
}

export async function convertMdtoHtml(content) {
    let result = content;
    result = result.replace(/\\/gi, "\\\\"); //Fix blackkslashes
    let remarkable = new Remarkable('full', {
        html: true,
        breaks: true,
        typographer: false,
    });
    remarkable.inline.ruler.disable(['sub', 'sup', 'ins']);
    remarkable.block.ruler.disable(['code']);
    // Handle codeblocks
    remarkable.set({
        langPrefix: 'hljs language-',
        highlight: function (str, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(lang, str).value;
                } catch (err) {}
            }
            try {
                return hljs.highlightAuto(str).value;
            } catch (err) {}
            return '';
        }
    });          
    const originalFenceRenderRule = remarkable.renderer.rules.fence;
    remarkable.renderer.rules.fence = (tokens, idx, ...args) => {
      if(!tokens[idx].params) {
        tokens[idx].params = "auto";
      }
      return originalFenceRenderRule(tokens, idx, ...args);
    };      
    // Handle Images
    const originalLinkValidator = remarkable.inline.validateLink;
    const dataLinkRegex = /^\s*data:([a-z]+\/[a-z]+(;[a-z-]+=[a-z-]+)?)?(;base64)?,[a-z0-9!$&',()*+,;=\-._~:@/?%\s]*\s*$/i;
    const isImage = /^.*\.(png|jpg|jpeg|bmp|tiff|gif|apng|svg|webp)$/i;
    const isWebURL = /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;
    remarkable.inline.validateLink = (url: string) => originalLinkValidator(url) || encodeURI(url).match(dataLinkRegex) || (encodeURI(url).match(isImage) && !encodeURI(url).match(isWebURL));
    const originalImageRenderRule = remarkable.renderer.rules.image;
    let graphPath = (await logseq.App.getCurrentGraph()).path;
    remarkable.renderer.rules.image = (...args) => {
        if ((encodeURI(args[0][args[1]].src).match(isImage) && !encodeURI(args[0][args[1]].src).match(isWebURL))) { // Image is relative to vault
            let imgPath = path.join(graphPath, args[0][args[1]].src.replace(/^(\.\.\/)+/, ""));
            AnkiConnect.storeMediaFileByPath(encodeURIComponent(args[0][args[1]].src), imgPath); // Flatten and save
            args[0][args[1]].src = encodeURIComponent(args[0][args[1]].src); // Flatten image and convert to markdown.
        }
        return originalImageRenderRule(...args);
    };
    // Render and decode html
    result = remarkable.render(result);
    result = decodeHTMLEntities(result);
    return result;
}

export async function convertOrgtoHtml(content) {
    let result = content;
    return result;
}
export async function convertToHtml(content: string, format: string = "markdown"): Promise<string> {
    let result = content;   

    result = await convertLogseqMarkuptoHtml(result);
    if (format == "markdown") {
        result = await convertMdtoHtml(result);
    } else if (format == "org") { 
        result = await convertOrgtoHtml(result);
    };

    return result;
}