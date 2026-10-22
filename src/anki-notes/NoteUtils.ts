/**
 * Utility functions for Note classes
 */

import _ from "lodash";
import {type HTMLFile, LogseqToHtmlConverterProxy} from "../logseq/LogseqToHtmlConverter";

export interface IdBasedExtra {
    cId: number;
    extra: string;
}

/** Encode plain-text extras before conversion so they stay literal and enter the cache key. */
export function appendIdBasedExtrasToContent(content: string, elements: IdBasedExtra[]): string {
    if (!elements.length) return content;
    const ids = [...new Set(elements.map((element) => element.cId))];
    return `${content}\n<div class="hidden">
        <div data-element-extra-markers>${ids.map((cId) => `{{c${cId}::<span data-element-extra-cloze="${cId}"> </span>}}`).join("")}</div>
        <div data-id-based-extras>${encodeURIComponent(JSON.stringify({elements}))}</div>
        </div>`;
}

/**
 * Appends extra property content to an HTMLFile if present.
 *
 * @param htmlFile - The HTMLFile to append extra content to (will be cloned)
 * @param extra - The extra property value (can be string or array)
 * @param format - The format (markdown or org) for conversion
 * @param isExtraBlock - If true, adds "extra-block" CSS class for block-level extra (non-indented)
 * @returns Promise resolving to a new HTMLFile with extra content appended
 */
export async function appendExtraToHtmlFile(
    htmlFile: HTMLFile,
    extra: string | string[] | undefined,
    format: string,
    isExtraBlock = false
): Promise<HTMLFile> {
    const result: HTMLFile = _.cloneDeep(htmlFile);

    if (extra) {
        const extraContent = Array.isArray(extra) ? extra.join(" ") : extra;
        const converted = await LogseqToHtmlConverterProxy.convertToHTMLFile(extraContent, format);
        converted.assets.forEach((asset) => result.assets.add(asset));
        const cssClass = isExtraBlock ? "extra extra-block" : "extra";
        result.html += `\n<div class="${cssClass}">${converted.html}</div>`;
    }

    return result;
}
