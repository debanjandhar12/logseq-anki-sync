import {LogseqProxy} from "./LogseqProxy";
import {BlockUUID} from "@logseq/libs/dist/LSPlugin";
import _ from "lodash";
import getContentDirectDependencies from "../converter/getContentDirectDependencies";
import hashSum from 'hash-sum';

let cache = {};

export const getBlockHash = async (blockUUID) => {
    let toHash = [];
    let block = await LogseqProxy.Editor.getBlock(blockUUID);
    toHash.push({content:_.get(block, 'content',''), format:_.get(block, 'format','markdown'), parent:_.get(block, 'parent.id',''), left:_.get(block, 'left.id','')});
    for(let dep of getContentDirectDependencies(_.get(block, 'content',''), _.get(block, 'format',''))) {
        if (dep.type === "Block")
            toHash.push(await getBlockHash(dep.value));
        else if(dep.type === "Page") toHash.push(getPageHash(dep.value));
    }
    cache[blockUUID+"Block"] = hashSum(toHash);
    return cache[blockUUID+"Block"];
};

export const getPageHash = async (pageName) => {
    let toHash = [];
    let page = await LogseqProxy.Editor.getPage(pageName);
    toHash.push({updatedAt:_.get(page, 'updatedAt','')});
    cache[pageName+"Page"] = hashSum(toHash);
    return cache[pageName+"Page"];
}

export const clearCache = () => {
    cache = {};
}