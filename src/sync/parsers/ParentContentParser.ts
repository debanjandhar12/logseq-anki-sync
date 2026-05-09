import _ from "lodash";
import type {Note} from "../../anki-notes/Note";
import {LogseqProxy} from "../../logseq/LogseqProxy";
import {LogseqToHtmlConverterProxy} from "../../logseq/LogseqToHtmlConverter";
import {escapeClozesAndMacroDelimiters} from "../../utils/utils";

interface ParentContentResult {
    html: string;
    assets: Set<string>;
    tags: Set<string>;
}

export class ParentContentParser {
    static async parse(
        note: Note,
        html: string,
        assets: Set<string>,
        tags: Set<string>
    ): Promise<ParentContentResult> {
        const {includeParentContent} = LogseqProxy.Settings.getPluginSettings();

        if (!includeParentContent) {
            return {html, assets, tags};
        }

        const parentBlocks = await ParentContentParser.collectParentBlocks(note, tags);
        const wrappedHtml = await ParentContentParser.wrapWithParentContent(
            html,
            parentBlocks,
            note,
            assets
        );

        return {html: wrappedHtml, assets, tags};
    }

    private static async collectParentBlocks(note: Note, tags: Set<string>) {
        const parentBlocks = [];
        let parentID = (await LogseqProxy.Editor.getBlock(note.uuid)).parent.id;
        let parent;

        while ((parent = await LogseqProxy.Editor.getBlock(parentID)) != null) {
            const parentTags = _.get(parent, "properties.tags", []) as string[];
            const hiddenParent =
                parentTags.includes("hide-when-card-parent") ||
                Array.from(tags).includes("hide-all-card-parent");

            parentBlocks.push({
                content: escapeClozesAndMacroDelimiters(parent.content),
                format: parent.format,
                uuid: parent.uuid,
                hiddenParent,
                properties: parent.properties
            });
            parentID = parent.parent.id;
        }

        return parentBlocks.reverse();
    }

    private static async wrapWithParentContent(
        html: string,
        parentBlocks: any[],
        note: Note,
        assets: Set<string>
    ): Promise<string> {
        let newHtml = "";

        for (const parentBlock of parentBlocks) {
            const parentBlockConverted = await LogseqToHtmlConverterProxy.convertToHTMLFile(
                parentBlock.content,
                parentBlock.format
            );

            parentBlockConverted.assets.forEach((asset) => assets.add(asset));

            const isNumbered =
                _.get(parentBlock, "properties['logseq.orderListType']") === "number";
            newHtml += `<ul class="children-list"><li class="children ${isNumbered ? "numbered" : ""}">`;

            if (parentBlock.hiddenParent) {
                newHtml += `<span class="hidden-parent">${parentBlockConverted.html}</span>`;
            } else {
                newHtml += parentBlockConverted.html;
            }
        }

        const isNumbered = _.get(note, "properties['logseq.orderListType']") === "number";
        newHtml += `<ul class="children-list"><li class="children ${isNumbered ? "numbered" : ""}">${html}</li></ul>`;

        for (let i = 0; i < parentBlocks.length; i++) {
            newHtml += `</li></ul>`;
        }

        return newHtml;
    }
}
