import {Mldoc} from "mldoc";
import {isAudio_REGEXP, isImage_REGEXP, isVideo_REGEXP } from "../constants";
import _ from "lodash";

export class BlockContentParser {
    private static async _find(blockContent : string, blockContentFormat: "org" | 'Org' | 'Markdown',findType: 'link' | 'html' | 'hiccup' | 'img' | 'audio' | 'video' | 'inline_code' | 'code' | 'inline_math' | 'math' | 'tag') {
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

        if (!blockContent || blockContent == "") return [];

        if (blockContentFormat == "org" || blockContentFormat == 'Org') {
            mldocsOptions.format = "Org";
        } else mldocsOptions.format = "Markdown";

        let parsedJson = Mldoc.parseInlineJson(
            blockContent,
            JSON.stringify({...mldocsOptions, parse_outline_only: true}),
            JSON.stringify({}),
        );
        let blockContentUTF8 = new TextEncoder().encode(blockContent); // Convert to utf8 array as mldocs outputs position according to utf8 https://github.com/logseq/mldoc/issues/120
        try {
            parsedJson = JSON.parse(parsedJson);
        } catch {
            parsedJson = [];
            console.log("Error parsing block content");
            logseq.UI.showMsg("LogseqWrapper.BlockContentParser.forEach: Error parsing block content", "error");
        }

        const result = [];
        for (let i = parsedJson.length - 1; i >= 0; i--) {
            // node's start_pos is bound to be larger than next item's end_pos due to how Mldoc.parseInlineJson works
            const node = parsedJson[i];
            if (node[node.length - 1]["start_pos"] == null) continue;
            if (node[0][0] == null) continue;
            const type = node[0][0];
            const start_pos = node[node.length - 1]["start_pos"];
            const end_pos = node[node.length - 1]["end_pos"];
            const nodeContent = new TextDecoder().decode(blockContentUTF8.slice(start_pos, end_pos));

            // TODO: Potentially, web / local file links will not be parsed correctly in org mode
            if (type == "Link") {
                const link_type = _.get(node[0][1], "url[0]");
                let link_url = _.get(node[0][1], "url[1]");
                if (typeof link_url === "object") {
                    if (link_url.protocol && link_url.link) {
                        link_url = link_url.protocol + "://" + link_url.link;
                    }
                }
                const link_full_text = _.get(node[0][1], "full_text");
                const link_label_text = _.get(node[0][1], "label[0][1]");
                if ((link_type == "Search" || link_type == "Complex") &&
                    link_url.match(isImage_REGEXP) &&
                    link_full_text.startsWith("!") && findType == "img") {
                    result.push({
                        type: "img",
                        content: nodeContent,
                        start_pos: start_pos,
                        end_pos: end_pos,
                        url: link_url,
                        label: link_label_text,
                    });
                }
                else if ((link_type == "Search" || link_type == "Complex") &&
                    link_url.match(isAudio_REGEXP) &&
                    link_full_text.startsWith("!") && findType == "audio") {
                    result.push({
                        type: "audio",
                        content: nodeContent,
                        start_pos: start_pos,
                        end_pos: end_pos,
                        url: link_url,
                        label: link_label_text,
                    });
                }
                else if ((link_type == "Search" || link_type == "Complex")  &&
                    link_url.match(isVideo_REGEXP) &&
                    link_full_text.startsWith("!") && findType == "video") {
                    result.push({
                        type: "video",
                        content: nodeContent,
                        start_pos: start_pos,
                        end_pos: end_pos,
                        url: link_url,
                        label: link_label_text,
                    });
                }
                else if ((link_type == "Search" || link_type == "Complex")  &&
                    !link_full_text.startsWith("!")  && findType == "link") {
                    result.push({
                        type: "link",
                        content: nodeContent,
                        start_pos: start_pos,
                        end_pos: end_pos,
                        url: link_url,
                        label: link_label_text,
                    });
                }
            }
            else if (type == "Tag" && findType == "tag") {
                result.push({
                    type: "tag",
                    content: nodeContent,
                    start_pos: start_pos,
                    end_pos: end_pos,
                });
            }
            else if ((type == "Raw_Html" || type == "Inline_Html") && findType == "html") {
                result.push({
                    type: "html",
                    content: nodeContent,
                    start_pos: start_pos,
                    end_pos: end_pos,
                });
            }
            else if ((type == "Raw_Hiccup" || type == "Inline_Hiccup") && findType == "hiccup") {
                result.push(node);
            }
            else if (type == "Code") {
                if (nodeContent.startsWith(`\`\`\``) && findType == "code") {
                    result.push({
                        type: "code",
                        content: nodeContent+'`',
                        start_pos: start_pos,
                        end_pos: end_pos+1,
                    });
                }
                else if (nodeContent.startsWith("#BEGIN_SRC") && findType == "code") {
                    result.push({
                        type: "code",
                        content: nodeContent,
                        start_pos: start_pos,
                        end_pos: end_pos,
                    });
                }
                else if (findType == "inline_code") {
                    result.push({
                        type: "inline_code",
                        content: nodeContent,
                        start_pos: start_pos,
                        end_pos: end_pos,
                    });
                }
            }
            else if (type == "Latex_Fragment") {
                const inlineOrDisplayed = node[0][1][0];
                if (findType == "inline_math" && inlineOrDisplayed == "Inline") {
                    result.push({
                        type: "inline_math",
                        content: nodeContent,
                        start_pos: start_pos,
                        end_pos: end_pos,
                    });
                }
                else if (findType == "math" && inlineOrDisplayed == "Displayed") {
                    result.push({
                        type: "math", // displayed math
                        content: nodeContent,
                        start_pos: start_pos,
                        end_pos: end_pos,
                    });
                }
            }
        }
        return result;
    }

    static async find(blockContent : string, blockContentFormat: "org" | 'Org' | 'Markdown',findTypeArr: ('link' | 'html' | 'hiccup' | 'img' | 'audio' | 'video' | 'inline_code' | 'code' | 'inline_math' | 'math' | 'tag')[]) {
        let result = [];
        for (const findType of findTypeArr) {
            const found = await this._find(blockContent, blockContentFormat, findType);
            if (found) result = [...result, ...found];
        }
        return result;
    }

    static async forEach(blockContent : string, blockContentFormat: "org" | 'Org' | 'Markdown',findTypeArr: ('link' | 'html' | 'hiccup' | 'img' | 'audio' | 'video' | 'inline_code' | 'code' | 'inline_math' | 'math' | 'tag')[], callback: (node: any) => void) {
        for (const findType of findTypeArr) {
            const found = await this._find(blockContent, blockContentFormat, findType);
            if (found) found.forEach((node) => callback(node));
        }
    }

    static async findAndReplace(blockContent : string, blockContentFormat: "org" | 'Org' | 'Markdown',findTypeArr: ('link' | 'html' | 'hiccup' | 'img' | 'audio' | 'video' | 'inline_code' | 'code' | 'inline_math' | 'math' | 'tag')[], replaceCallback: (node: any) => string) {
        let result = blockContent;
        for (const findType of findTypeArr) {
            let foundArr = await this._find(blockContent, blockContentFormat, findType);
            foundArr = foundArr.sort((a, b) => b.start_pos - a.start_pos);
            foundArr.forEach((node) => {
                result = result.substring(0, node.start_pos) + replaceCallback(node) + result.substring(node.end_pos);
            });
        }
        return result;
    }
}