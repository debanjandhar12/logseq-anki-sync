/**
 * This class is responsible for calculating the hash of a note using the Logseq Block UUID of note's block dependencies.
 * In order to calculate the hash of a note, other than note's complete block dependencies, it also considers:
 * 1. Current / Future anki Fields (passed as argument)
 * 2. Current Plugin Settings and Version
 * 3. Some properties of the page where block is located
 * 4. Logseq Page Id field
 */

import _ from "lodash";
import path from "path-browserify";
import pkg from "../../../package.json";
import type {Note} from "../../anki-notes/Note";
import {createLogger, LoggerCategory} from "../../logger";
import getNameFromPage from "../../logseq/getNameFromPage";
import getUUIDFromBlock from "../../logseq/getUUIDFromBlock";
import {LogseqProxy} from "../../logseq/LogseqProxy";
import objectHashOptimized from "../../utils/objectHashOptimized";
import type {ParsedNoteData} from "../types";
import {getBlockHash, getPageHash} from "./BlockAndPageHashCache";

const logger = createLogger(LoggerCategory.SyncCacheLayer);

export default class NoteHashCalculator {
    /**
     * Gets a map of asset filenames to their modifiedTime timestamps
     */
    private static async getAssetModifiedTimeMap(): Promise<Map<string, number>> {
        const assetModifiedTimeMap = new Map<string, number>();
        try {
            const files = await LogseqProxy.Assets.listFilesOfCurrentGraph();
            if (Array.isArray(files)) {
                for (const file of files) {
                    const filename = path.basename(file.path);
                    assetModifiedTimeMap.set(filename, file.modifiedTime);
                }
            } else {
                throw new Error("Failed to load file list... likely called from web ver");
            }
        } catch (e) {
            logger.error("Error getting asset modified times", e);
        }
        return assetModifiedTimeMap;
    }
    public static async getHash(note: Note, ankiFields: ParsedNoteData): Promise<number> {
        const toHash = [];
        const dependencies = note.getBlockDependencies();

        // Only consider parent content if includeParentContent is true
        // No need to consider parent content for breadcrumbs as
        // we use the page updatedAt timestamp in hash
        // This is req since otherwise on property value change of parent block, hash won't change.
        let parentID = (await LogseqProxy.Editor.getBlock(note.uuid)).parent.id;
        let parent = null;
        const {includeParentContent} = LogseqProxy.Settings.getPluginSettings();
        if (includeParentContent) {
            while ((parent = await LogseqProxy.Editor.getBlock(parentID)) != null) {
                const logseqBlockUUID = getUUIDFromBlock(parent) || parent.parent.id;
                dependencies.push({
                    type: "Block",
                    value: logseqBlockUUID
                });
                parentID = parent.parent.id;
            }
        }

        // Get hash of all dependency blocks and pages
        for (const dep of dependencies) {
            if (dep.type === "Block") toHash.push(await getBlockHash(dep.value));
            else if (dep.type === "Page") toHash.push(await getPageHash(dep.value));
        }

        // Add namespace dependencies
        const page = await LogseqProxy.Editor.getPage(note.pageId);
        const parentPages = await LogseqProxy.Editor.getParentNamespacePages(page);
        for (const parentPage of parentPages) {
            const pageId = parentPage.id;
            if (pageId && typeof pageId === "number") {
                toHash.push(await getPageHash(pageId));
            }
        }

        // Add additional things to toHash
        toHash.push(getNameFromPage(page));

        // Include Logseq Page Id in hash calculation
        toHash.push(note.pageId);

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
            ])
        );
        toHash.push(pkg.version);

        // Add additional things from ankiFields to toHash
        let [html, assets, deck, breadcrumb, tags] = ankiFields;
        tags = tags.filter((tag: string) => tag.toLowerCase() !== "leech"); // Remove leech from tags arr
        tags = tags.filter((tag: string) => tag.toLowerCase() !== "marked"); // Also remove marked
        const assetsArray = Array.from(assets).sort();
        tags.sort();

        // Get asset modified times and include them in hash calculation
        const assetModifiedTimeMap = await NoteHashCalculator.getAssetModifiedTimeMap();
        const assetsWithModifiedTime = assetsArray.map((assetPath: string) => {
            const filename = path.basename(assetPath);
            const modifiedTime = assetModifiedTimeMap.get(filename) || 0;
            return modifiedTime;
        });

        toHash.push([
            html.trim(),
            assetsWithModifiedTime,
            deck ? deck.trim().toLowerCase() : "",
            breadcrumb.trim(),
            tags
        ]);

        // Return hash
        return objectHashOptimized(toHash);
    }
}
