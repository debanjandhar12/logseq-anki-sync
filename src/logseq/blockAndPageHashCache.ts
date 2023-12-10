/**
 * This service maintains a cache of block hashes to detect changes in the block content.
 * The idea of this is to actively maintaining a dependency graph.
 * NB: Please pass only block UUIDs and page names to the functions of this service. Do not pass datalog ids.
 */
import {DepGraph} from "dependency-graph";
import {LogseqProxy} from "./LogseqProxy";
import getUUIDFromBlock from "./getUUIDFromBlock";
import getContentDirectDependencies from "../converter/getContentDirectDependencies";
import hashSum from "hash-sum";
import _ from "lodash";
import {MD_PROPERTIES_REGEXP, ORG_PROPERTIES_REGEXP} from "../constants";
import {getFirstNonEmptyLine} from "../utils/utils";
let graph = new DepGraph();

// -- Hash Dependency Graph --
const clearGraph = () => {
    graph = new DepGraph();
};

const removeBlockNode = (blockUUID) => {
    blockUUID = blockUUID.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    if (!graph.hasNode(blockUUID + "Block")) return;
    graph.dependantsOf(blockUUID + "Block").forEach((dependant) => {
        graph.removeNode(dependant);
    });
    graph.removeNode(blockUUID + "Block");
};

const removeFirstLineOfBlockNode = (blockUUID) => {
    blockUUID = blockUUID.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    if (!graph.hasNode(blockUUID + "FirstLineOfBlock")) return;
    graph.dependantsOf(blockUUID + "FirstLineOfBlock").forEach((dependant) => {
        graph.removeNode(dependant);
    });
    graph.removeNode(blockUUID + "FirstLineOfBlock");
};

const removePageNode = (pageName) => {
    pageName = pageName.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    if (!graph.hasNode(pageName + "Page")) return;
    graph.dependantsOf(pageName + "Page").forEach((dependant) => {
        graph.removeNode(dependant);
    });
    graph.removeNode(pageName + "Page");
};

const addPageNode = async (pageName) => {
    pageName = pageName.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    if (graph.hasNode(pageName + "Page")) return;
    const page = await LogseqProxy.Editor.getPage(pageName);
    const toHash = [];
    toHash.push([_.get(page, "updatedAt", "")]); // A Page has no dependencies, so we just hash the updatedAt timestamp
    graph.addNode(pageName + "Page", hashSum(toHash));
};

const addBlockNode = async (blockUUID) => {
    blockUUID = blockUUID.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    if (graph.hasNode(blockUUID + "Block")) return;
    graph.addNode(blockUUID + "Block");
    const block = await LogseqProxy.Editor.getBlock(blockUUID);
    const blockPage = await LogseqProxy.Editor.getPage(_.get(block, "page.id", ""));
    const directDependencies = await getContentDirectDependencies(
        _.get(block, "content", ""),
        _.get(block, "format", ""),
    );
    for (const dependency of directDependencies) {
        if (dependency.type === "Block") await addBlockNode(dependency.value);
        else if (dependency.type === "FirstLineOfBlock")
            await addFirstLineOfBlockNode(dependency.value);
        else if (dependency.type === "Page") await addPageNode(dependency.value);
        graph.addDependency(blockUUID + "Block", dependency.value + dependency.type);
    }
    const toHash = [];
    graph.dependenciesOf(blockUUID + "Block").forEach((dependency) => {
        toHash.push(graph.getNodeData(dependency));
    });
    toHash.push([
        _.get(blockPage, "updatedAt", ""),
        _.get(block, "content", "").length,
        _.get(block, "content", "").slice(0, 4),
        _.get(block, "content", "").slice(-1, -5),
        _.get(block, "parent.id", ""),
        _.get(block, "left.id", ""),
    ]);
    graph.setNodeData(blockUUID + "Block", hashSum(toHash));
};

const addFirstLineOfBlockNode = async (blockUUID) => {
    blockUUID = blockUUID.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    if (graph.hasNode(blockUUID + "FirstLineOfBlock")) return;
    graph.addNode(blockUUID + "FirstLineOfBlock");
    const block = await LogseqProxy.Editor.getBlock(blockUUID);
    const blockContentFirstLine = getFirstNonEmptyLine(
        _.get(block, "content", "")
            .replaceAll(MD_PROPERTIES_REGEXP, "")
            .replaceAll(ORG_PROPERTIES_REGEXP, ""),
    );
    const directDependencies = await getContentDirectDependencies(
        blockContentFirstLine,
        _.get(block, "format", ""),
    );
    for (const dependency of directDependencies) {
        if (dependency.type === "Block") await addBlockNode(dependency.value);
        else if (dependency.type === "FirstLineOfBlock")
            await addFirstLineOfBlockNode(dependency.value);
        else if (dependency.type === "Page") await addPageNode(dependency.value);
        graph.addDependency(blockUUID + "FirstLineOfBlock", dependency.value + dependency.type);
    }
    const toHash = [];
    graph.dependenciesOf(blockUUID + "FirstLineOfBlock").forEach((dependency) => {
        toHash.push(graph.getNodeData(dependency));
    });
    toHash.push([
        blockContentFirstLine,
        _.get(block, "format", "markdown"),
        _.get(block, "parent.id", ""),
        _.get(block, "left.id", ""),
    ]);
    graph.setNodeData(blockUUID + "FirstLineOfBlock", hashSum(toHash));
};

export const getBlockHash = async (blockUUID) => {
    blockUUID = blockUUID.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    await addBlockNode(blockUUID);
    return graph.getNodeData(blockUUID + "Block");
};

export const getFirstLineOfBlockHash = async (blockUUID) => {
    blockUUID = blockUUID.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    await addFirstLineOfBlockNode(blockUUID);
    return graph.getNodeData(blockUUID + "FirstLineOfBlock");
};

export const getPageHash = async (pageName) => {
    pageName = pageName.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    await addPageNode(pageName);
    return graph.getNodeData(pageName + "Page");
};

// -- Maintain Cache State by using DB.onChanged --
export const init = () => {
    LogseqProxy.DB.registerDBChangeListener(async ({blocks, txData, txMeta}) => {
        if (!logseq.settings.cacheLogseqAPIv1) return;
        for (const tx of txData) {
            const [txBlockID, txType, ...additionalDetails] = tx;
            if (txType != "left" && txType != "parent") continue;
            let block = await logseq.Editor.getBlock(txBlockID);
            if (block != null) blocks.push(block);
            block = await logseq.Editor.getBlock(additionalDetails[0]);
            if (block != null) blocks.push(block);
        }
        while (blocks.length > 0) {
            const block = blocks.pop();
            block.uuid = getUUIDFromBlock(block);
            if (block.uuid != null) {
                removeBlockNode(block.uuid);
                removeFirstLineOfBlockNode(block.uuid);
            }
            if (block.originalName != null) removePageNode(block.originalName);
            if (block.name != null) removePageNode(block.name);
        }
    });
    LogseqProxy.Settings.registerSettingsChangeListener((newSettings, oldSettings) => {
        if (!newSettings.cacheLogseqAPIv1) clearGraph();
    });
    LogseqProxy.App.registerGraphChangeListener((e) => {
        console.log("Working");
        clearGraph();
    });
    LogseqProxy.App.registerGraphIndexedListener((e) => {
        clearGraph();
    });
    window.addEventListener("syncLogseqToAnkiComplete", () => {
        if (!logseq.settings.cacheLogseqAPIv1) clearGraph();
    });
};
