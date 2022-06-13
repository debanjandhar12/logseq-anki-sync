import { BlockEntity, BlockIdentity, EntityID, PageIdentity } from "@logseq/libs/dist/LSPlugin";
import AwaitLock from "await-lock";
import objectHash from "object-hash";
/***
 * Syncronization-safe logseq api wrapper for the Logseq plugin.
 * This is needed to fix #58
 * */

type LogSeqOperation = {
    operation: String,
    parameters: any
}
type LogSeqOperationHash = string;

let cache = new Map<LogSeqOperationHash, any>();
let cacheHit = 0;
let originalCacheGet = cache.get.bind(cache);
cache.get = function (key: LogSeqOperationHash) {
    cacheHit++;
    return originalCacheGet(key);
}
let getLogseqLock = new AwaitLock();
export namespace SyncronizedLogseq {
    export class Editor {
        static async getBlock(srcBlock: BlockIdentity | EntityID, opts?: Partial<{ includeChildren: boolean; }>): Promise<BlockEntity | null> {
            if (cache.has(objectHash({ operation: "getBlock", parameters: { srcBlock, opts } })))
                return cache.get(objectHash({ operation: "getBlock", parameters: { srcBlock, opts } }));
            let block = null;
            await getLogseqLock.acquireAsync();
            try {
                block = await logseq.Editor.getBlock(srcBlock, opts);
                cache.set(objectHash({ operation: "getBlock", parameters: { srcBlock, opts } }), block);
            }
            catch (e) { console.error(e); }
            finally { getLogseqLock.release(); }
            return block;
        }

        static async getPage(srcPage: PageIdentity | EntityID): Promise<PageIdentity | null> {
            if (cache.has(objectHash({ operation: "getPage", parameters: { srcPage } })))
                return cache.get(objectHash({ operation: "getPage", parameters: { srcPage } }));
            let page = null;
            await getLogseqLock.acquireAsync();
            try {
                page = await logseq.Editor.getPage(srcPage);
                cache.set(objectHash({ operation: "getPage", parameters: { srcPage } }), page);
            }
            catch (e) { console.error(e); }
            finally { getLogseqLock.release(); }
            return page;
        }

        static async getPageBlocksTree(srcPage: PageIdentity): Promise<Array<BlockEntity>> {
            if (cache.has(objectHash({ operation: "getPageBlocksTree", parameters: { srcPage } })))
                return cache.get(objectHash({ operation: "getPageBlocksTree", parameters: { srcPage } }));
            let pageBlockTree = null;
            await getLogseqLock.acquireAsync();
            try {
                pageBlockTree = await logseq.Editor.getPageBlocksTree(srcPage);
                cache.set(objectHash({ operation: "getPageBlocksTree", parameters: { srcPage } }), pageBlockTree);
            }
            catch (e) { console.error(e); }
            finally { getLogseqLock.release(); }
            return pageBlockTree;
        }

        static async upsertBlockProperty(block: BlockIdentity, key: string, value: any): Promise<void> {
            await getLogseqLock.acquireAsync();
            try { await logseq.Editor.upsertBlockProperty(block, key, value); }
            catch (e) { console.error(e); }
            finally { getLogseqLock.release(); }
        }
    }
    export class Cache {
        static clear(): void {
            console.log("Cache Hit:" ,cacheHit);
            cacheHit = 0;
            cache.clear();
        }
    }
}