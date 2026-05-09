/**
 * This service maintains a cache of block hashes to detect changes in the block content.
 * A block content can have block embeds, page embeds, block references, etc.
 * The idea of this is to maintain a dependency graph and calculate hash based on it.
 * This way, hash will change when we need to re-render the block.
 * Primarily, we can avoid LogseqToHtmlConverter if block hash has not changed.
 *
 * IMPORTANT: Only pass block UUIDs and page IDs to the functions of this service.
 */

import type {BlockUUID, PageIdentity} from "@logseq/libs/dist/LSPlugin";
import {DepGraph} from "dependency-graph";
import _ from "lodash";
import {createLogger, LoggerCategory} from "../../logger";
import getLogseqContentDirectDependencies from "../../logseq/getLogseqContentDirectDependencies";
import {LogseqProxy} from "../../logseq/LogseqProxy";
import {WindowParentBridge} from "../../logseq/WindowParentBridge";
import objectHashOptimized from "../../utils/objectHashOptimized";

const logger = createLogger(LoggerCategory.SyncCacheLayer);

let graph = new DepGraph();

// -- Hash Dependency Graph --
const clearGraph = () => {
    graph = new DepGraph();
};

const removeBlockNode = (blockUUID: BlockUUID) => {
    blockUUID = blockUUID.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    if (!graph.hasNode(blockUUID + "Block")) return;
    graph.dependantsOf(blockUUID + "Block").forEach((dependant) => {
        graph.removeNode(dependant);
    });
    graph.removeNode(blockUUID + "Block");
};

const removePageNode = (pageId: number) => {
    const pageKey = pageId + "PageById";

    if (!graph.hasNode(pageKey)) return;
    graph.dependantsOf(pageKey).forEach((dependant) => {
        graph.removeNode(dependant);
    });
    graph.removeNode(pageKey);
};

const addPageNode = async (pageId: number) => {
    const pageKey = pageId + "PageById";

    if (graph.hasNode(pageKey)) return true;

    const page = await LogseqProxy.Editor.getPage(pageId);
    if (!page) return false;

    const toHash = [];
    toHash.push([
        _.get(page, "updatedAt", ""),
        _.get(page, "parent.id", "") || _.get(page, "namespace.id", ""),
        page.id
    ]);
    // TODO: consider adding refs as dependencies
    graph.addNode(pageKey, objectHashOptimized(toHash));
    return true;
};

const addBlockNode = async (blockUUID: BlockUUID) => {
    blockUUID = blockUUID.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    if (graph.hasNode(blockUUID + "Block")) return;
    graph.addNode(blockUUID + "Block");
    const block = await LogseqProxy.Editor.getBlock(blockUUID);
    if (!block) return;
    const blockPage = await LogseqProxy.Editor.getPage(_.get(block, "page.id", "") as PageIdentity);
    const directDependencies = await getLogseqContentDirectDependencies(
        _.get(block, "content", ""),
        _.get(block, "format", "")
    );
    for (const dependency of directDependencies) {
        let nodeCreated = false;
        if (dependency.type === "Block") {
            await addBlockNode(dependency.value);
            nodeCreated = graph.hasNode(dependency.value.toLowerCase() + "Block");
        } else if (dependency.type === "Page") {
            nodeCreated = await addPageNode(dependency.value);
        }

        // Only add dependency if the node was successfully created
        if (nodeCreated) {
            const depKey =
                dependency.type === "Block"
                    ? dependency.value.toLowerCase() + "Block"
                    : dependency.value + "PageById";
            graph.addDependency(blockUUID + "Block", depKey);
        }
    }
    const toHash = [];
    graph.dependenciesOf(blockUUID + "Block").forEach((dependency) => {
        toHash.push(graph.getNodeData(dependency));
    });
    toHash.push([
        _.get(blockPage, "updatedAt", ""),
        _.get(block, "properties", ""),
        _.get(block, "updatedAt", ""),
        _.get(block, "content", "").length,
        _.get(block, "parent.id", ""),
        _.get(block, "page.id", ""),
        _.get(block, "left.id", "")
    ]);
    graph.setNodeData(blockUUID + "Block", objectHashOptimized(toHash));
};

export const getBlockHash = async (blockUUID) => {
    blockUUID = blockUUID.toLowerCase(); // Convert to lowercase to avoid case sensitivity issues

    await addBlockNode(blockUUID);
    return graph.getNodeData(blockUUID + "Block");
};

export const getPageHash = async (pageId: number) => {
    const pageKey = pageId + "PageById";

    await addPageNode(pageId);
    return graph.getNodeData(pageKey);
};

// -- Maintain Cache State by using DB.onChanged --
export const init = () => {
    WindowParentBridge.addEventListener("syncLogseqToAnkiComplete", () => {
        logger.info("Clearing dependency graph cache");
        clearGraph();
    });
};
