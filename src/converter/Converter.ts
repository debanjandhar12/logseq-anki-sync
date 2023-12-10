import hljs from "highlight.js";
import "@logseq/libs";
import * as cheerio from "cheerio";
import {
    decodeHTMLEntities,
    escapeClozeAndSecoundBrace,
    getFirstNonEmptyLine,
    getRandomUnicodeString,
    safeReplace,
    safeReplaceAsync,
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
    MD_PROPERTIES_REGEXP,
    ORG_MATH_BLOCK_REGEXP,
    ORG_PROPERTIES_REGEXP,
    specialChars,
    LOGSEQ_RENAMED_PAGE_REF_REGEXP,
    isAudio_REGEXP,
} from "../constants";
import {LogseqProxy} from "../logseq/LogseqProxy";
import * as hiccupConverter from "@thi.ng/hiccup";
import {edn} from "@yellowdig/cljs-tools";
import path from "path-browserify";
import objectHash from "../utils/objectHashOptimized";

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

const convertToHTMLFileCache = new Map<string, HTMLFile>();
window.addEventListener("syncLogseqToAnkiComplete", () => {
    convertToHTMLFileCache.clear();
});

export async function convertToHTMLFile(
    content: string,
    format = "markdown",
    opts = {processRefEmbeds: true},
): Promise<HTMLFile> {
    if (
        convertToHTMLFileCache.has(
            objectHash({
                content,
                format,
                processRefEmbeds: opts.processRefEmbeds,
            }),
        )
    )
        return convertToHTMLFileCache.get(
            objectHash({
                content,
                format,
                processRefEmbeds: opts.processRefEmbeds,
            }),
        );

    let resultContent = content.trim(),
        resultAssets = new Set<string>(),
        resultTags = new Set<string>();
    if (logseq.settings.debug.includes("Converter.ts"))
        console.log("--Start Converting--\nOriginal:", resultContent);

    resultContent = await processProperties(resultContent, format);
    if (logseq.settings.debug.includes("Converter.ts"))
        console.log("After processing embeded:", resultContent);

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
    let resultUTF8 = new TextEncoder().encode(resultContent); // Convert to utf8 array as mldocs outputs position according to utf8 https://github.com/logseq/mldoc/issues/120
    for (let i = parsedJson.length - 1; i >= 0; i--) {
        // node's start_pos is bound to be larger than next item's end_pos due to how Mldoc.parseInlineJson works
        const node = parsedJson[i];
        if (node[node.length - 1]["start_pos"] == null) continue;
        if (node[0][0] == null) continue;

        const type = node[0][0];
        const start_pos = node[node.length - 1]["start_pos"];
        const end_pos = node[node.length - 1]["end_pos"];
        switch (type) {
            case "Raw_Html":
            case "Inline_Html":
                resultUTF8 = await processInlineHTML(
                    node,
                    start_pos,
                    end_pos,
                    resultContent,
                    resultAssets,
                    resultUTF8,
                    hashmap,
                );
                break;
            case "Raw_Hiccup":
            case "Inline_Hiccup":
                resultUTF8 = await processInlineHiccup(
                    node,
                    start_pos,
                    end_pos,
                    resultContent,
                    resultUTF8,
                    hashmap,
                );
                break;
            case "Link":
                resultUTF8 = await processLink(
                    node,
                    start_pos,
                    end_pos,
                    resultContent,
                    resultAssets,
                    resultUTF8,
                    hashmap,
                    format,
                );
                break;
        }
    }
    resultContent = new TextDecoder().decode(resultUTF8);
    if (logseq.settings.debug.includes("Converter.ts"))
        console.log("After replacing errorinous terms:", resultContent);

    // Process the block & page refs + embeds
    if (opts.processRefEmbeds)
        resultContent = await processRefEmbeds(
            resultContent,
            resultAssets,
            resultTags,
            hashmap,
            format,
        );
    else resultContent = await hideRefEmbeds(resultContent, resultAssets, hashmap, format);

    // Render the markdown
    resultContent = Mldoc.export(
        "html",
        resultContent,
        JSON.stringify(mldocsOptions),
        JSON.stringify({}),
    );
    // Render images and and codes
    const $ = cheerio.load(resultContent, {decodeEntities: false});
    $("pre code").each(function (i, elm) {
        // Syntax hightlight block code (block codes are preceded by pre)
        $(elm).addClass("hljs");
        try {
            if (elm.attribs["data-lang"]) {
                $(elm).html(
                    hljs
                        .highlight(elm.attribs["data-lang"], $(elm).html())
                        .value.replace(/\n$/, ""),
                );
            } else $(elm).html(hljs.highlightAuto($(elm).html()).value.replace(/\n$/, ""));
        } catch (e) {
            console.warn(e);
        }
    });
    $("img").each(function (i, elm) {
        // Handle images
        console.warn(
            "Error: Image Found! Image should have been processed by processLink already and be hidden from cheerio.",
        );
    });
    const graphName = _.get(await logseq.App.getCurrentGraph(), "name");
    $("a.tag").each(function (i, elm) {
        // Handle tags
        let tagName = $(elm).text(),
            afterText = "";
        // Handle tags with [[ at start and ]] at end
        if (tagName.match(/\[\[(.*?)\]\]/)) tagName = tagName.match(/\[\[(.*?)\]\]/)[1];
        // Sometimes special characters get appended to tag name. Hence, we need to put them after tag.
        if (tagName.match(new RegExp(`.*?([${specialChars}]+)`, ""))) {
            afterText = tagName.match(new RegExp(`.*?([${specialChars}]+)`, ""))[1];
            tagName = tagName.replace(new RegExp(`([${specialChars}]+)$`, ""), "");
        }
        // Add tags to resultTags and add logseq page link to the tag
        resultTags.add(tagName);
        $(elm).replaceWith(
            `<a class="tag" href="logseq://graph/${encodeURIComponent(
                graphName,
            )}?page=${encodeURIComponent(tagName)}">${tagName}</a>${afterText}`,
        );
    });
    $(".mathblock, .latex-environment").each(function (i, elm) {
        // Handle org math and latex-environment blocks
        let math = $(elm).html();
        // Remove all types of math braces in math
        math = math.replace(ORG_MATH_BLOCK_REGEXP, "$1");
        math = math.replace(MD_MATH_BLOCK_REGEXP, "$1");

        // Add block math braces in math
        $(elm).html(`\\[ ${math} \\]`);
    });
    // Change all p tags to span tags
    $("p").each(function (i, elm) {
        $(elm).replaceWith(`<span>${$(elm).html()}</span>`);
    });
    // Fix #126 - Revert the `display: flex` for some org blocks which are made flex in _logseq_anki_sync.scss by adding a new child div with `display: revert`
    $("div.important, div.caution, div.pinned, div.tip, div.note, div.warning").each(
        function (i, elm) {
            $(elm).html(`<div style="display: revert">${$(elm).html()}</div>`);
        },
    );
    resultContent = decodeHTMLEntities(decodeHTMLEntities($("#content ul li").html() || ""));
    if (logseq.settings.debug.includes("Converter.ts"))
        console.log("After Mldoc.export:", resultContent);

    // Bring back inline html content and clozes from hashmap
    for (const key in hashmap) resultContent = safeReplace(resultContent, key, hashmap[key]);
    for (const key in hashmap) resultContent = safeReplace(resultContent, key, hashmap[key]); // fix: sometimes the end space of hash gets removed (actual fix require this to be repeated len(keys) times instead of 2)

    if (logseq.settings.debug.includes("Converter.ts"))
        console.log("After bringing back errorinous terms:", resultContent, "\n---End---");
    convertToHTMLFileCache.set(
        objectHash({
            content,
            format,
            processRefEmbeds: opts.processRefEmbeds,
        }),
        {html: resultContent, assets: resultAssets, tags: resultTags},
    );
    return {html: resultContent, assets: resultAssets, tags: resultTags};
}

export async function processProperties(resultContent, format = "markdown"): Promise<string> {
    resultContent = safeReplace(resultContent, ORG_PROPERTIES_REGEXP, ""); //Remove org properties
    const block_props = {};
    resultContent = safeReplace(resultContent, MD_PROPERTIES_REGEXP, (match) => {
        //Remove md properties
        const [key, value] = match.split("::");
        block_props[key.trim()] = value.trim();
        return "";
    });
    // Add support for pdf annotation
    block_props["ls-type"] = block_props["ls-type"] || block_props["lsType"];
    block_props["hl-type"] = block_props["hl-type"] || block_props["hlType"];
    block_props["hl-page"] = block_props["hl-page"] || block_props["hlPage"];
    block_props["hl-stamp"] = block_props["hl-stamp"] || block_props["hlStamp"];
    if (block_props["ls-type"] == "annotation" && block_props["hl-type"] == "area") {
        // Image annotation
        try {
            const block_uuid = block_props["id"] || block_props["nid"];
            const block = await LogseqProxy.Editor.getBlock(block_uuid);
            const page = await LogseqProxy.Editor.getPage(_.get(block, "page.id"));
            const hls_img_loc = `../assets/${_.get(page, "originalName", "").replace(
                "hls__",
                "",
            )}/${block_props["hl-page"]}_${block_uuid}_${
                block_props["hl-stamp"]
            }.png?imageAnnotationBlockUUID=${block_uuid}`;
            resultContent =
                `\ud83d\udccc**P${block_props["hl-page"]}** <div></div> ![](${hls_img_loc})\n` +
                resultContent;
        } catch (e) {
            console.log(e);
        }
    } else if (block_props["ls-type"] == "annotation") {
        // Text annotation
        try {
            resultContent = `\ud83d\udccc**P${block_props["hl-page"]}** ` + resultContent;
        } catch (e) {
            console.log(e);
        }
    }
    return resultContent;
}

async function processRefEmbeds(
    resultContent,
    resultAssets,
    resultTags,
    hashmap,
    format,
): Promise<string> {
    let block;
    resultContent = await safeReplaceAsync(
        resultContent,
        LOGSEQ_EMBDED_BLOCK_REGEXP,
        async (match, g1) => {
            // Convert block embed
            const getBlockEmbedContentHTML = async (
                children: any,
                level = 0,
            ): Promise<string> => {
                if (level >= 100) return "";
                let result = `\n<ul class="children-list">`;
                for (const child of children) {
                    result += `\n<li class="children">`;
                    // _.get(block, "content").replace(ANKI_CLOZE_REGEXP, "$3").replace(/(?<!{{embed [^}\n]*?)}}/g, "} } ") || "";
                    const block_content =
                        escapeClozeAndSecoundBrace(_.get(child, "content")) || "";
                    const format = _.get(child, "format") || "markdown";
                    const blockContentHTMLFile = await convertToHTMLFile(block_content, format);
                    blockContentHTMLFile.assets.forEach((element) => {
                        resultAssets.add(element);
                    });
                    if (child.children.length > 0)
                        blockContentHTMLFile.html += await getBlockEmbedContentHTML(
                            child.children,
                            level + 1,
                        );

                    result += blockContentHTMLFile.html;
                    result += `</li>`;
                }
                result += `</ul>`;
                return result;
            };

            try {
                block = await LogseqProxy.Editor.getBlock(g1, {
                    includeChildren: true,
                });
            } catch (e) {
                console.warn(e);
            }
            const str = getRandomUnicodeString();
            hashmap[str] = `<div class="embed-block">
                        ${block ? await getBlockEmbedContentHTML([block]) : ""}
                        </div>`;
            return str;
        },
    );

    resultContent = await safeReplaceAsync(
        resultContent,
        LOGSEQ_EMBDED_PAGE_REGEXP,
        async (match, pageName) => {
            // Convert page embed
            let pageTree = [];
            const getPageContentHTML = async (children: any, level = 0): Promise<string> => {
                if (level >= 100) return "";
                let result = `\n<ul class="children-list">`;
                for (const child of children) {
                    result += `\n<li class="children">`;
                    const block_content =
                        escapeClozeAndSecoundBrace(_.get(child, "content")) || "";
                    const format = _.get(child, "format") || "markdown";
                    const blockContentHTMLFile = await convertToHTMLFile(block_content, format);
                    blockContentHTMLFile.assets.forEach((element) => {
                        resultAssets.add(element);
                    });
                    if (child.children.length > 0)
                        blockContentHTMLFile.html += await getPageContentHTML(
                            child.children,
                            level + 1,
                        );

                    result += blockContentHTMLFile.html;
                    result += `</li>`;
                }
                result += `</ul>`;
                return result;
            };
            try {
                pageTree = await LogseqProxy.Editor.getPageBlocksTree(pageName);
            } catch (e) {
                console.warn(e);
            }

            const str = getRandomUnicodeString();
            hashmap[str] = `<div class="embed-page">
                        <a href="logseq://graph/${encodeURIComponent(
                            _.get(await logseq.App.getCurrentGraph(), "name"),
                        )}?page=${encodeURIComponent(
                            pageName,
                        )}" class="embed-header">${pageName}</a>
                        ${await getPageContentHTML(pageTree)}
                        </div>`;
            return str;
        },
    );

    resultContent = await safeReplaceAsync(
        resultContent,
        LOGSEQ_RENAMED_PAGE_REF_REGEXP,
        async (match, aliasContent, pageName) => {
            // Convert page refs
            const str = getRandomUnicodeString();
            hashmap[str] = `<a href="logseq://graph/${encodeURIComponent(
                _.get(await logseq.App.getCurrentGraph(), "name"),
            )}?page=${encodeURIComponent(
                pageName,
            )}" class="page-reference">${aliasContent}</a>`;
            return str;
        },
    );

    resultContent = await safeReplaceAsync(
        resultContent,
        LOGSEQ_PAGE_REF_REGEXP,
        async (match, pageName) => {
            // Convert page refs
            if (format == "org" && encodeURI(pageName).match(isImage_REGEXP)) {
                return `![](${pageName})`;
            } else if (format == "org" && encodeURI(pageName).match(isWebURL_REGEXP)) {
                return `${pageName}`;
            }
            const str = getRandomUnicodeString();
            hashmap[str] = `<a href="logseq://graph/${encodeURIComponent(
                _.get(await logseq.App.getCurrentGraph(), "name"),
            )}?page=${encodeURIComponent(pageName)}" class="page-reference">${pageName}</a>`;
            return str;
        },
    );

    resultContent = await safeReplaceAsync(
        resultContent,
        LOGSEQ_RENAMED_BLOCK_REF_REGEXP,
        async (match, aliasContent, blockUUID) => {
            // Convert page refs
            const str = getRandomUnicodeString();
            hashmap[str] = `<a href="logseq://graph/${encodeURIComponent(
                _.get(await logseq.App.getCurrentGraph(), "name"),
            )}?block-id=${encodeURIComponent(
                blockUUID,
            )}" class="block-ref">${aliasContent}</a>`;
            return str;
        },
    );

    resultContent = await safeReplaceAsync(
        resultContent,
        LOGSEQ_BLOCK_REF_REGEXP,
        async (match, blockUUID) => {
            // Convert block refs
            const str = getRandomUnicodeString();
            try {
                const block = await LogseqProxy.Editor.getBlock(blockUUID);
                let block_content = _.get(block, "content");
                const block_props = _.get(block, "properties");
                block_content = safeReplace(block_content, MD_PROPERTIES_REGEXP, "");
                block_content = safeReplace(block_content, ORG_PROPERTIES_REGEXP, "");
                let block_content_first_line = getFirstNonEmptyLine(block_content).trim();
                block_content_first_line = escapeClozeAndSecoundBrace(block_content_first_line);
                let blockRef_content = block_content_first_line;
                for (const [prop, value] of Object.entries(block_props))
                    blockRef_content += `\n${prop}:: ${value}`;
                const blockRefHTMLFile = await convertToHTMLFile(
                    blockRef_content,
                    _.get(block, "format"),
                );
                blockRefHTMLFile.assets.forEach((element) => {
                    resultAssets.add(element);
                });
                hashmap[str] = `<span onclick="window.open('logseq://graph/${encodeURIComponent(
                    _.get(await logseq.App.getCurrentGraph(), "name"),
                )}?block-id=${encodeURIComponent(blockUUID)}')" class="block-ref">${
                    blockRefHTMLFile.html
                }</span>`;
            } catch (e) {
                // Block not found
                console.warn(e);
                hashmap[str] = `<span class="failed-block-ref">${blockUUID}</span>`;
            }
            return str;
        },
    );

    return resultContent;
}

async function hideRefEmbeds(resultContent, resultAssets, hashmap, format): Promise<string> {
    resultContent = await safeReplaceAsync(
        resultContent,
        LOGSEQ_BLOCK_REF_REGEXP,
        async (match, blockUUID) => {
            // Convert block refs
            const str = getRandomUnicodeString();
            hashmap[str] = match;
            return str;
        },
    );
    resultContent = await safeReplaceAsync(
        resultContent,
        LOGSEQ_PAGE_REF_REGEXP,
        async (match, pageName) => {
            // Convert page refs
            if (format == "org" && encodeURI(pageName).match(isImage_REGEXP)) {
                return `![](${pageName})`;
            } else if (format == "org" && encodeURI(pageName).match(isWebURL_REGEXP)) {
                return `${pageName}`;
            }
            const str = getRandomUnicodeString();
            hashmap[str] = `<a class="page-reference">${pageName}</a>`;
            return str;
        },
    );
    return resultContent;
}

async function processInlineHTML(
    node,
    start_pos,
    end_pos,
    resultContent,
    resultAssets,
    resultUTF8,
    hashmap,
) {
    const content = new TextDecoder().decode(resultUTF8.slice(start_pos, end_pos));
    if (content != node[0][1]) {
        console.error(
            "Error: content mismatch html",
            content,
            resultContent.substring(start_pos, end_pos),
        );
    }
    const str = getRandomUnicodeString();
    hashmap[str] = content;
    return new Uint8Array([
        ...resultUTF8.subarray(0, start_pos),
        ...new TextEncoder().encode(str),
        ...resultUTF8.subarray(end_pos),
    ]);
}

async function processInlineHiccup(
    node,
    start_pos,
    end_pos,
    resultContent,
    resultUTF8,
    hashmap,
) {
    const content = new TextDecoder().decode(resultUTF8.slice(start_pos, end_pos));
    if (content != node[0][1]) {
        console.error(
            "Error: content mismatch hiccup",
            content,
            resultContent.substring(start_pos, end_pos),
        );
    }
    const str = getRandomUnicodeString();
    hashmap[str] = hiccupConverter.serialize(edn.decode(content));
    return new Uint8Array([
        ...resultUTF8.subarray(0, start_pos),
        ...new TextEncoder().encode(str),
        ...resultUTF8.subarray(end_pos),
    ]);
}

async function processLink(
    node,
    start_pos,
    end_pos,
    resultContent,
    resultAssets,
    resultUTF8,
    hashmap,
    format,
) {
    const content = new TextDecoder().decode(resultUTF8.slice(start_pos, end_pos));
    console.log("link node", node);
    const link_type = _.get(node[0][1], "url[0]");
    const link_url = _.get(node[0][1], "url[1]");
    let metadata;
    try {
        metadata = await edn.decode(node[0][1].metadata);
    } catch (e) {
        console.warn(e);
    }
    const link_full_text = _.get(node[0][1], "full_text");
    const link_label_type = _.get(node[0][1], "label[0][0]");
    const link_label_text = _.get(node[0][1], "label[0][1]");
    // Image Display
    if (
        link_type == "Search" &&
        link_url.match(isImage_REGEXP) &&
        !content.match(isWebURL_REGEXP) &&
        link_full_text.startsWith("!")
    ) {
        const str = getRandomUnicodeString();
        hashmap[str] = `<img src="${path.basename(link_url).split("?")[0]}" ${
            link_label_text ? `title="${link_label_text}"` : ``
        } ${metadata && metadata.width ? `width="${metadata.width}"` : ``} ${
            metadata && metadata.height ? `height="${metadata.height}"` : ``
        }/>`;
        resultAssets.add(link_url.split("?")[0]);
        return new Uint8Array([
            ...resultUTF8.subarray(0, start_pos),
            ...new TextEncoder().encode(str),
            ...resultUTF8.subarray(end_pos),
        ]);
    }
    if (
        link_type == "Complex" &&
        link_url.link.match(isImage_REGEXP) &&
        (format == "org" || link_full_text.match(MD_IMAGE_EMBEDED_REGEXP))
    ) {
        const str = getRandomUnicodeString();
        hashmap[str] = `<img src="${link_url.protocol}://${link_url.link.split("?")[0]}" ${
            link_label_text ? `title="${link_label_text}"` : ``
        } ${metadata && metadata.width ? `width="${metadata.width}"` : ``} ${
            metadata && metadata.height ? `height="${metadata.height}"` : ``
        }/>`;
        return new Uint8Array([
            ...resultUTF8.subarray(0, start_pos),
            ...new TextEncoder().encode(str),
            ...resultUTF8.subarray(end_pos),
        ]);
    }
    if (
        format == "org" &&
        link_type == "Page_ref" &&
        link_url.match(isImage_REGEXP) &&
        !link_url.match(isWebURL_REGEXP)
    ) {
        const str = getRandomUnicodeString();
        hashmap[str] = `<img src="${path.basename(link_url).split("?")[0]}" />`;
        resultAssets.add(link_url.split("?")[0]);
        return new Uint8Array([
            ...resultUTF8.subarray(0, start_pos),
            ...new TextEncoder().encode(str),
            ...resultUTF8.subarray(end_pos),
        ]);
    }

    // Audio Display
    if (
        link_type == "Search" &&
        link_url.match(isAudio_REGEXP) &&
        !content.match(isWebURL_REGEXP) &&
        link_full_text.startsWith("!")
    ) {
        const str = getRandomUnicodeString();
        hashmap[str] = `[sound:${path.basename(link_url).split("?")[0]}]`;
        resultAssets.add(link_url.split("?")[0]);
        return new Uint8Array([
            ...resultUTF8.subarray(0, start_pos),
            ...new TextEncoder().encode(str),
            ...resultUTF8.subarray(end_pos),
        ]);
    }
    if (
        link_type == "Complex" &&
        link_url.link.match(isAudio_REGEXP) &&
        (format == "org" || link_full_text.match(MD_IMAGE_EMBEDED_REGEXP))
    ) {
        const str = getRandomUnicodeString();
        hashmap[str] = `[sound:${link_url.protocol}://${link_url.link.split("?")[0]}]`;
        return new Uint8Array([
            ...resultUTF8.subarray(0, start_pos),
            ...new TextEncoder().encode(str),
            ...resultUTF8.subarray(end_pos),
        ]);
    }
    if (
        format == "org" &&
        link_type == "Page_ref" &&
        link_url.match(isAudio_REGEXP) &&
        !link_url.match(isWebURL_REGEXP)
    ) {
        const str = getRandomUnicodeString();
        hashmap[str] = `[sound:${path.basename(link_url).split("?")[0]}]`;
        resultAssets.add(link_url.split("?")[0]);
        return new Uint8Array([
            ...resultUTF8.subarray(0, start_pos),
            ...new TextEncoder().encode(str),
            ...resultUTF8.subarray(end_pos),
        ]);
    }

    // Fix #74
    if (link_type == "Complex" && link_url.protocol && link_label_type == "Plain") {
        const str = getRandomUnicodeString();
        hashmap[
            str
        ] = `<a href="${link_url.protocol}://${link_url.link}">${link_label_text}</a>`;
        return new Uint8Array([
            ...resultUTF8.subarray(0, start_pos),
            ...new TextEncoder().encode(str),
            ...resultUTF8.subarray(end_pos),
        ]);
    }

    return new Uint8Array([
        ...resultUTF8.subarray(0, start_pos),
        ...new TextEncoder().encode(content),
        ...resultUTF8.subarray(end_pos),
    ]);
}
