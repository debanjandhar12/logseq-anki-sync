import { LogseqProxy } from "../LogseqProxy";
import { BlockUUID } from "@logseq/libs/dist/LSPlugin";
import { getFirstNonEmptyLine } from '../utils';
import getContentDirectDependencies, { PageEntityName, ReferenceDependency } from '../converter/getContentDirectDependencies';
import hashSum from 'hash-sum';
import _ from "lodash";

export let getRecursiveDependenciesHashCache = new Map<string, string>();
export async function getBlockRecursiveDependenciesHash(dependency: ReferenceDependency): Promise<string> {
    if (getRecursiveDependenciesHashCache.has(dependency.value+dependency.type)) return getRecursiveDependenciesHashCache.get(dependency.value+dependency.type);
    let toHash = [];
    let block, page;
    switch (dependency.type) {
        case "Embedded_Block_ref":
            block = await LogseqProxy.Editor.getBlock(dependency.value as BlockUUID);
            toHash.push({content:_.get(block, 'content',''), format:_.get(block, 'format','markdown'), parent:_.get(block, 'parent.id',''), left:_.get(block, 'left.id','')});
            for(let dep of getContentDirectDependencies(_.get(block, 'content',''), _.get(block, 'format',''))) {
                toHash.push(await getBlockRecursiveDependenciesHash(dep));
            }
        break;
        case "Block_ref":
            block = await LogseqProxy.Editor.getBlock(dependency.value as BlockUUID);
            toHash.push({content: _.get(block, 'content',''), format:_.get(block, 'format','markdown'), parent:_.get(block, 'parent.id',''), left:_.get(block, 'left.id','')});
            // Currently, Block_ref is not rendered by Converter. Hence, we can just ignore children dependencies of it.
            // Please uncomment the following lines when Block Ref Renderer is implemented.
            /* 
            let block_content = _.get(block, 'content','');
            block_content = replace(block_content, MD_PROPERTIES_REGEXP, "");
            block_content = replace(block_content, ORG_PROPERTIES_REGEXP, "");
            let block_content_first_line = getFirstNonEmptyLine(block_content);
            for(let dep of getContentDirectDependencies(block_content_first_line, _.get(block, 'format',''))) {
                toHash.push(await getBlockRecursiveDependenciesHash(dep));
            } */
        break;
        case "Embedded_Page_ref":
            page = await LogseqProxy.Editor.getPage(PageEntityName.name);
            toHash.push({content:_.get(page, 'updatedAt','')});
        break;
    }
    let hash = hashSum(toHash);
    getRecursiveDependenciesHashCache.set(dependency.value+dependency.type, hash);
    return hash;
}
