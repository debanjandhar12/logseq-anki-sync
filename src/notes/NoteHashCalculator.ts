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
import {DependencyEntity} from "../converter/getContentDirectDependencies";
import {
    getBlockHash,
    getFirstLineOfBlockHash,
    getPageHash,
} from "../logseq/blockAndPageHashCache";
import _ from "lodash";

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
            deck: encodeURIComponent(_.get(note, "page.properties.deck", "")),
        });
        if (_.get(note, "page.namespace.id") != null) {
            // Include properties of root namespace, fixes https://github.com/debanjandhar12/logseq-anki-sync/pull/143#issuecomment-1403965977
            const rootPageName = _.get(note, "page.name").split("/")[0];
            toHash.push({
                rootPageProps: _.get(
                    await LogseqProxy.Editor.getPage(rootPageName),
                    "properties",
                    {},
                ),
            });
        }
        toHash.push(
            _.omit(logseq.settings, [
                "addons",
                "renderAnkiClozeMarcosInLogseq",
                "skipOnDependencyHashMatch",
                "cacheLogseqAPIv1",
                "debug",
            ]),
        );
        toHash.push({v: pkg.version});

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
