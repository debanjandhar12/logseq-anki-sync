/**
 * This service maintains a cache of block hashes to detect changes in the block content.
 * The idea of this is to actively maintaining a dependency graph.
 */
import { DepGraph } from 'dependency-graph';
import {LogseqProxy} from "./LogseqProxy";
import getUUIDFromBlock from "./getUUIDFromBlock";
import getContentDirectDependencies from "../converter/getContentDirectDependencies";
import hashSum from 'hash-sum';
import _ from "lodash";
import {MD_PROPERTIES_REGEXP, ORG_PROPERTIES_REGEXP} from "../constants";
import {getFirstNonEmptyLine} from "../utils";
let graph = new DepGraph();

// -- Hash Dependency Graph --
const clearGraph = () => {
    graph = new DepGraph();
}

const removeBlockNode = (blockUUID) => {
    if(!graph.hasNode(blockUUID+"Block")) return;
    graph.dependantsOf(blockUUID+"Block").forEach((dependant) => {
        graph.removeNode(dependant);
    });
    graph.removeNode(blockUUID+"Block");
}

const removeFirstLineOfBlockNode = (blockUUID) => {
    if(!graph.hasNode(blockUUID+"FirstLineOfBlock")) return;
    graph.dependantsOf(blockUUID+"FirstLineOfBlock").forEach((dependant) => {
        graph.removeNode(dependant);
    });
    graph.removeNode(blockUUID+"FirstLineOfBlock");
}

const removePageNode = (pageName) => {
    if(!graph.hasNode(pageName+"Page")) return;
    graph.dependantsOf(pageName+"Page").forEach((dependant) => {
        graph.removeNode(dependant);
    });
    graph.removeNode(pageName+"Page");
}

const addPageNode = async (pageName) => {
    if(graph.hasNode(pageName+"Page")) return;
    const page = await LogseqProxy.Editor.getPage(pageName);
    const toHash = [];
    toHash.push({updatedAt:_.get(page, 'updatedAt','')}); // A Page has no dependencies, so we just hash the updatedAt timestamp
    graph.addNode(pageName+"Page", hashSum(toHash));
}

const addBlockNode = async (blockUUID) => {
    if(graph.hasNode(blockUUID+"Block")) return;
    graph.addNode(blockUUID+"Block");
    const block = await LogseqProxy.Editor.getBlock(blockUUID);
    const directDependencies = getContentDirectDependencies(_.get(block, 'content',''), _.get(block, 'format',''));
    for (let dependency of directDependencies) {
        if(dependency.type === "Block") await addBlockNode(dependency.value);
        else if(dependency.type === "FirstLineOfBlock") await addFirstLineOfBlockNode(dependency.value);
        else if(dependency.type === "Page") await addPageNode(dependency.value);
        graph.addDependency(blockUUID+"Block", dependency.value+dependency.type);
    }
    const toHash = [];
    graph.dependenciesOf(blockUUID+"Block").forEach((dependency) => {
        toHash.push(graph.getNodeData(dependency));
    });
    toHash.push({content:_.get(block, 'content',''), format:_.get(block, 'format','markdown'), parent:_.get(block, 'parent.id',''), left:_.get(block, 'left.id','')});
    graph.setNodeData(blockUUID+"Block", hashSum(toHash));
}

const addFirstLineOfBlockNode = async (blockUUID) => {
    if(graph.hasNode(blockUUID+"FirstLineOfBlock")) return;
    graph.addNode(blockUUID+"FirstLineOfBlock");
    const block = await LogseqProxy.Editor.getBlock(blockUUID);
    const directDependencies = getContentDirectDependencies(getFirstNonEmptyLine(_.get(block, 'content','').replaceAll(MD_PROPERTIES_REGEXP, '').replaceAll(ORG_PROPERTIES_REGEXP, '')), _.get(block, 'format',''));
    for (let dependency of directDependencies) {
        if(dependency.type === "Block") await addBlockNode(dependency.value);
        else if(dependency.type === "FirstLineOfBlock") await addFirstLineOfBlockNode(dependency.value);
        else if(dependency.type === "Page") await addPageNode(dependency.value);
        graph.addDependency(blockUUID+"FirstLineOfBlock", dependency.value+dependency.type);
    }
    const toHash = [];
    graph.dependenciesOf(blockUUID+"FirstLineOfBlock").forEach((dependency) => {
        toHash.push(graph.getNodeData(dependency));
    });
    toHash.push({content:_.get(block, 'content',''), format:_.get(block, 'format','markdown'), parent:_.get(block, 'parent.id',''), left:_.get(block, 'left.id','')});
    graph.setNodeData(blockUUID+"FirstLineOfBlock", hashSum(toHash));
}

export const getBlockHash = async (blockUUID) => {
    await addBlockNode(blockUUID);
    return graph.getNodeData(blockUUID+"Block");
};

export const getFirstLineOfBlockHash = async (blockUUID) => {
    await addFirstLineOfBlockNode(blockUUID);
    return graph.getNodeData(blockUUID+"FirstLineOfBlock");
};

export const getPageHash = async (pageName) => {
    await addPageNode(pageName);
    return graph.getNodeData(pageName+"Page");
}

// -- Maintain Cache State by using DB.onChanged --
export const init = () => {
    LogseqProxy.DB.registerDBChangeListener(async ({blocks, txData, txMeta}) => {
        if (!logseq.settings.cacheLogseqAPIv1) return;
        for(let tx of txData) {
            let [txBlockID, txType, ...additionalDetails] = tx;
            if(txType != "left" && txType != "parent") continue;
            let block = await LogseqProxy.Editor.getBlock(txBlockID);
            if(block != null) blocks.push(block);
            block = await LogseqProxy.Editor.getBlock(additionalDetails[0]);
            if(block != null) blocks.push(block);
        }
        while (blocks.length > 0) {
            let block = blocks.pop();
            block.uuid = getUUIDFromBlock(block);
            if (block.uuid != null) {
                removeBlockNode(block.uuid);
                removeFirstLineOfBlockNode(block.uuid);
            }
            if(block.originalName != null) {
                removePageNode(block.originalName);
            }
        }
    });
    LogseqProxy.Settings.registerSettingsChangeListener((newSettings, oldSettings) => {
        if (!newSettings.cacheLogseqAPIv1) clearGraph();
    });
    window.addEventListener('syncLogseqToAnkiComplete', () => {
        if (!logseq.settings.cacheLogseqAPIv1) clearGraph();
    });
}