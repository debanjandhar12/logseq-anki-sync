/**
 * This class is responsible for calculating the hash of a note using the uuid of note's block dependencies.
 * In order to calculate the hash of a note, other than note's complete block dependencies, it also considers:
 * 1. Current / Future anki Fields (passed as argument)
 * 2. Current Plugin Settings and Version
 * 3. Some properties of the page where block is located
 */

import { Note } from "../../anki-notes/Note";
import pkg from "../../../package.json";
import { LogseqProxy } from "../../logseq/LogseqProxy";
import getUUIDFromBlock from "../../logseq/getUUIDFromBlock";
import { DependencyEntity } from "../../logseq/getLogseqContentDirectDependencies";
import {
    getBlockHash,
    getPageHash,
} from "./blockAndPageHashCache";
import _ from "lodash";
import objectHashOptimized from "../../utils/objectHashOptimized";
import path from "path-browserify";
import { ParsedNoteData } from "../types";
import getNameFromPage from "../../logseq/getNameFromPage";


export default class NoteHashCalculator {
    /**
     * Gets a map of asset filenames to their modifiedTime timestamps
     */
    private static async getAssetModifiedTimeMap(): Promise<Map<string, number>> {
        const assetModifiedTimeMap = new Map<string, number>();
        try {
            const files = await LogseqProxy.Assets.listFilesOfCurrentGraph();
            for (const file of files) {
                const filename = path.basename(file.path);
                assetModifiedTimeMap.set(filename, file.modifiedTime);
            }
        } catch (e) {
            console.error("[NoteHashCalculator] Error getting asset modified times:", e);
        }
        return assetModifiedTimeMap;
    }
    public static async getHash(note: Note, ankiFields: ParsedNoteData): Promise<number> {
        const toHash = [];
        const dependencies = note.getBlockDependencies();

        // Only consider parent content if includeParentContent is true
        // No need to consider parent content for breadcrumbs as
        // we use the page updatedAt timestamp in hash
        let parentID = (await LogseqProxy.Editor.getBlock(note.uuid)).parent.id;
        let parent = null;
        const { includeParentContent } = LogseqProxy.Settings.getPluginSettings();
        if (includeParentContent) {
            while ((parent = await LogseqProxy.Editor.getBlock(parentID)) != null) {
                const blockUUID = getUUIDFromBlock(parent) || parent.parent.id;
                dependencies.push({
                    type: "Block",
                    value: blockUUID,
                });
                parentID = parent.parent.id;
            }
        }

        // Get hash of all dependency blocks and pages
        for (const dep of dependencies) {
            if (dep.type == "Block") toHash.push(await getBlockHash(dep.value));
            else if (dep.type == "Page") toHash.push(await getPageHash(dep.value));
        }

        // Add namespace dependencies using page ID
        const page = await LogseqProxy.Editor.getPage(note.pageId);
        const parentPages = await LogseqProxy.Editor.getParentNamespacePages(page);
        for (const parentPage of parentPages) {
            toHash.push(await getPageHash(parentPage.id));
        }

        // Add additional things to toHash
        toHash.push(getNameFromPage(page));
        
        const settings = LogseqProxy.Settings.getPluginSettings();
        toHash.push(
            _.omit(settings, [
                "addonsList",
                "renderClozeMarcosInLogseq",
                "hideClozeMarcosUntilHoverInLogseq",
                "skipOnDependencyHashMatch",
                "lastWelcomeVersion",
                "ankiFieldOptions",
                "debug"
            ]),
        );
        toHash.push(pkg.version);

        // Add additional things from ankiFields to toHash
        let [html, assets, deck, breadcrumb, tags, extra] = ankiFields;
        tags = tags.filter((tag: string) => tag.toLowerCase() != "leech"); // Remove leech from tags arr
        tags = tags.filter((tag: string) => tag.toLowerCase() != "marked"); // Also remove marked
        const assetsArray = Array.from(assets).sort();
        tags.sort();

        // Get asset modified times and include them in hash calculation
        const assetModifiedTimeMap = await this.getAssetModifiedTimeMap();
        const assetsWithModifiedTime = assetsArray.map((assetPath: string) => {
            const filename = path.basename(assetPath);
            const modifiedTime = assetModifiedTimeMap.get(filename) || 0;
            console.log(filename, assetPath, 'modifiedTime', modifiedTime);
            return modifiedTime;
        });

        toHash.push([
            html.trim(),
            assetsWithModifiedTime,
            deck ? deck.trim().toLowerCase() : "",
            breadcrumb.trim(),
            tags,
            extra.trim(),
        ]);

        // Return hash
        return objectHashOptimized(toHash);
    }
}
