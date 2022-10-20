/**
 * This class is responsible for calculating the hash of a note using the uuid of note's block dependencies.
 * In order to calculate the hash of a note, other than note's complete block dependencies, it also considers:
 * 1. Current / Future anki Fields (passed as argument)
 * 2. Current Plugin Settings and Version
 * 3. Some properties of the page where block is located
 */

import {Note} from "./Note";
import hashSum from 'hash-sum';
import pkg from '../../package.json';
import {LogseqProxy} from "../logseq/LogseqProxy";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";
import {DependencyEntity} from "../converter/getContentDirectDependencies";
import {getBlockHash, getFirstLineOfBlockHash, getPageHash} from "../logseq/blockAndPageHashCache";
import _ from 'lodash';

export default class NoteHashCalculator {
    public static async getHash(note: Note, ankiFields : any[]): Promise<string> {
        let toHash = [...ankiFields];

        // Collect parent And DirectDependencies (TODO: refactor parents out)
        let dependencies = note.getBlockDependencies();
        let parentID = (await LogseqProxy.Editor.getBlock(note.uuid)).parent.id;
        let parent;
        while ((parent = await LogseqProxy.Editor.getBlock(parentID)) != null) {
            let blockUUID = getUUIDFromBlock(parent) || parent.parent.id;
            if(logseq.settings.includeParentContent)
                dependencies.push({ type: "Block", value: blockUUID } as DependencyEntity);
            else dependencies.push({ type: "FirstLineOfBlock", value: blockUUID } as DependencyEntity);
            parentID = parent.parent.id;
        }

        // Call getBlockRecursiveDependenciesHash on parentAndDirectDependencies and add them to toHash
        for (const dep of dependencies) {
            if(dep.type == "Block") toHash.push(await getBlockHash(dep.value));
            else if(dep.type == "FirstLineOfBlock") toHash.push(await getFirstLineOfBlockHash(dep.value));
            else if(dep.type == "Page") toHash.push(await getPageHash(dep.value));
        }

        // Add additional things to toHash
        toHash.push({page:encodeURIComponent(_.get(note, 'page.originalName', '')), deck:encodeURIComponent(_.get(note, 'page.properties.deck', ''))});
        toHash.push({defaultDeck:logseq.settings.defaultDeck, includeParentContent: logseq.settings.includeParentContent, breadcrumbDisplay: logseq.settings.breadcrumbDisplay});
        toHash.push({v:pkg.version});

        // Return hash
        return hashSum(toHash);
    }
}