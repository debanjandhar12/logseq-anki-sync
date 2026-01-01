/**
 * This service maintains a cache of block hashes to detect changes in the block content.\
 * A block content can have block embeds, page embeds, block references, etc.
 * The idea of this is to maintain a dependency graph and calculate hash based on it.
 * This way, hash will change when we need to re-render the block.
 * Primarily, we can avoid LogseqToHtmlConverter if block hash has not changed.
 * NB: Please pass only block UUIDs and page names to the functions of this service. Do not pass datalog ids.
 */
import {DepGraph} from "dependency-graph";
import {LogseqProxy} from "../../logseq/LogseqProxy";
import getUUIDFromBlock from "../../logseq/getUUIDFromBlock";
import getLogseqContentDirectDependencies from "../../logseq/getLogseqContentDirectDependencies";
import _ from "lodash";
import {MD_PROPERTIES_REGEXP, ORG_PROPERTIES_REGEXP} from "../../constants";
import {getFirstNonEmptyLine} from "../../utils/utils";
import {BlockPageName, BlockUUID} from "@logseq/libs/dist/LSPlugin";
import objectHashOptimized from "../../utils/objectHashOptimized";
import {WindowParentBridge} from "../../logseq/WindowParentBridge";

let graph = new DepGraph();

// -- Hash Dependency Graph --
const clearGraph = () => {
    graph = new DepGraph();
};

const removeBlockNode = (blockUUID : BlockUUID) => {
    blockUUID = blockUUID.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    if (!graph.hasNode(blockUUID + "Block")) return;
    graph.dependantsOf(blockUUID + "Block").forEach((dependant) => {
        graph.removeNode(dependant);
    });
    graph.removeNode(blockUUID + "Block");
};

const removePageNode = (pageName: BlockPageName) => {
    pageName = pageName.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    if (!graph.hasNode(pageName + "Page")) return;
    graph.dependantsOf(pageName + "Page").forEach((dependant) => {
        graph.removeNode(dependant);
    });
    graph.removeNode(pageName + "Page");
};

const addPageNode = async (pageName: BlockPageName) => {
    pageName = pageName.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    if (graph.hasNode(pageName + "Page")) return;
    const page = await LogseqProxy.Editor.getPage(pageName);
    const toHash = [];
    toHash.push([_.get(page, "updatedAt", "")]);
    // TODO: consider adding refs as dependencies
    graph.addNode(pageName + "Page", objectHashOptimized(toHash));
};

const addBlockNode = async (blockUUID : BlockUUID) => {
    blockUUID = blockUUID.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    if (graph.hasNode(blockUUID + "Block")) return;
    graph.addNode(blockUUID + "Block");
    const block = await LogseqProxy.Editor.getBlock(blockUUID);
    if (!block) return;
    const blockPage = await LogseqProxy.Editor.getPage(block.page.id);
    const directDependencies = await getLogseqContentDirectDependencies(
        _.get(block, "content", ""),
        _.get(block, "format", ""),
    );
    for (const dependency of directDependencies) {
        if (dependency.type === "Block") await addBlockNode(dependency.value);
        else if (dependency.type === "Page") await addPageNode(dependency.value);
        graph.addDependency(blockUUID + "Block", dependency.value.toLowerCase() + dependency.type);
    }
    const toHash = [];
    graph.dependenciesOf(blockUUID + "Block").forEach((dependency) => {
        toHash.push(graph.getNodeData(dependency));
    });
    console.log(block);
    toHash.push([
        _.get(blockPage, "updatedAt", ""),
        _.get(block, "updatedAt", ""),
        _.get(block, "content", "").length,
        _.get(block, "parent.id", ""),
        _.get(block, "page.id", ""),
        _.get(block, "left.id", ""),
    ]);
    graph.setNodeData(blockUUID + "Block", objectHashOptimized(toHash));
};

export const getBlockHash = async (blockUUID) => {
    blockUUID = blockUUID.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    await addBlockNode(blockUUID);
    return graph.getNodeData(blockUUID + "Block");
};

export const getPageHash = async (pageName) => {
    pageName = pageName.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    await addPageNode(pageName);
    return graph.getNodeData(pageName + "Page");
};

// -- Maintain Cache State by using DB.onChanged --
export const init = () => {
    WindowParentBridge.addEventListener("syncLogseqToAnkiComplete", () => {
        const { debug } = LogseqProxy.Settings.getPluginSettings();
        if (debug?.includes("blockAndPageHashCache.ts")) {
            console.log("[blockAndPageHashCache] Clearing dependency graph cache");
        }
        clearGraph();
    });
}
