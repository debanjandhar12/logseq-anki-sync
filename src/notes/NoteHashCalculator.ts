/**
 * This class is responsible for calculating the hash of a note using the uuid of note's block dependencies.
 * In order to calculate the hash of a note, other than note's complete block dependencies, it also considers:
 * 1. Current / Future anki Fields (passed as argument)
 * 2. Current Plugin Settings and Version
 * 3. Some properties of the page where block is located
 */

import {Note} from "./Note";
import hashSum from "hash-sum";
import pkg from "../../package.json";
import {LogseqProxy} from "../logseq/LogseqProxy";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";
import {DependencyEntity} from "../logseq/getLogseqContentDirectDependencies";
import {
    getBlockHash,
    getFirstLineOfBlockHash,
    getPageHash,
} from "../logseq/blockAndPageHashCache";
import _ from "lodash";
import {getLogseqBlockPropSafe} from "../utils/utils";

export default class NoteHashCalculator {
    public static async getHash(note: Note, ankiFields: any[]): Promise<string> {
        const toHash = [];

        // Collect parent And DirectDependencies (TODO: refactor parents out)
        const dependencies = note.getBlockDependencies();
        let parentID = (await LogseqProxy.Editor.getBlock(note.uuid)).parent.id;
        let parent;
        while ((parent = await LogseqProxy.Editor.getBlock(parentID)) != null) {
            const blockUUID = getUUIDFromBlock(parent) || parent.parent.id;
            if (logseq.settings.includeParentContent)
                dependencies.push({
                    type: "Block",
                    value: blockUUID,
                } as DependencyEntity);
            else
                dependencies.push({
                    type: "FirstLineOfBlock",
                    value: blockUUID,
                } as DependencyEntity);
            parentID = parent.parent.id;
        }

        // Call getBlockRecursiveDependenciesHash on parentAndDirectDependencies and add them to toHash
        for (const dep of dependencies) {
            if (dep.type == "Block") toHash.push(await getBlockHash(dep.value));
            else if (dep.type == "FirstLineOfBlock")
                toHash.push(await getFirstLineOfBlockHash(dep.value));
            else if (dep.type == "Page") toHash.push(await getPageHash(dep.value));
        }

        // Add additional things from block to toHash
        toHash.push({
            page: encodeURIComponent(_.get(note, "page.originalName", "")),
            pageProps: _.get(note, "page.properties", ""),
        });
        if (_.get(note, "page.namespace.id") != null) {
            // Include properties of parent namespaces
            const pageParts = _.get(note, "page.name").split("/");
            for (let i = 1; i < pageParts.length; i++) {
                const namespace = pageParts.slice(0, i).join("/");
                toHash.push({
                    namespaceProperties:
                        _.get(await LogseqProxy.Editor.getPage(namespace), "properties", {})
                });
            }
        }
        toHash.push(
            _.omit(logseq.settings, [
                "addons",
                "renderClozeMarcosInLogseq",
                "hideClozeMarcosUntilHoverInLogseq",
                "cacheLogseqAPIv1",
                "debug",
            ]),
        );
        toHash.push({pluginVersion: pkg.version, logseqVersion: window.parent["logseq.sdk.core.version"] || ""});

        // Add additional things from ankiFields to toHash
        let [html, assets, deck, breadcrumb, tags, extra] = ankiFields;
        tags = tags.filter((tag: string) => tag.toLowerCase() != "leech"); // Remove leech from tags arr
        tags = tags.filter((tag: string) => tag.toLowerCase() != "marked"); // Also remove marked
        assets.sort();
        tags.sort();
        toHash.push({
            html: html.trim(),
            assets,
            deck,
            breadcrumb: breadcrumb.trim(),
            tags,
            extra: extra.trim(),
        });

        // Return hash
        return hashSum(toHash);
    }
}
