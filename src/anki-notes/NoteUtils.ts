/**
 * Utility functions for Note classes
 */

import _ from "lodash";
import {type HTMLFile, LogseqToHtmlConverterProxy} from "../logseq/LogseqToHtmlConverter";

export interface IdBasedExtra {
    cId: number;
    extra: string;
}

/** Append markers after conversion so Math/Code/Quote blocks cannot absorb them. */
export function createIdBasedExtraMarkers(elements: readonly IdBasedExtra[]): string {
    const ids = [...new Set(elements.map((element) => element.cId))];
    if (!ids.length) return "";
    return `<div class="hidden" data-element-extra-markers>${ids.map((cId) => `{{c${cId}::<span data-element-extra-cloze="${cId}"> </span>}}`).join("")}</div>`;
}

/** Convert extras separately, keeping inactive HTML inert until the answer is shown. */
export async function appendIdBasedExtrasToHtmlFile(
    htmlFile: HTMLFile,
    elements: readonly IdBasedExtra[],
    format: string
): Promise<HTMLFile> {
    const result: HTMLFile = _.cloneDeep(htmlFile);
    const rendered = [];
    for (const element of elements) {
        if (!element.extra.trim()) continue;
        const converted = await LogseqToHtmlConverterProxy.convertToHTMLFile(element.extra, format);
        converted.assets.forEach((asset) => result.assets.add(asset));
        rendered.push({cId: element.cId, html: converted.html});
    }
    if (rendered.length) {
        result.html += `\n<div class="hidden" data-id-based-extras>${encodeURIComponent(JSON.stringify({elements: rendered}))}</div>`;
    }
    return result;
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
