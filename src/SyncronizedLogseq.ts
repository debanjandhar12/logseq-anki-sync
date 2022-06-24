import { BlockEntity, BlockIdentity, BlockUUID, EntityID, PageEntity, PageIdentity } from "@logseq/libs/dist/LSPlugin";
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
                if(block == null) {
                    cache.set(objectHash({ operation: "getBlock", parameters: { srcBlock , opts } }), block);
                    return null;
                }
                let uuid : BlockUUID = block.uuid["$uuid$"] || block.uuid.Wd || block.uuid || null;
                let dbid = block.id || null;
                if (uuid != null) 
                    cache.set(objectHash({ operation: "getBlock", parameters: { srcBlock: uuid, opts } }), block);
                if (dbid != null)
                    cache.set(objectHash({ operation: "getBlock", parameters: { srcBlock: dbid, opts } }), block);
            }
            catch (e) { console.error(e); }
            finally { getLogseqLock.release(); }
            return block;
        }

        static async getBlocks(srcBlocks: (BlockIdentity | EntityID)[]): Promise<BlockEntity[] | null[]> {
            let result = [];
            let blockToFetch = [];
            for (let i = 0; i < srcBlocks.length; i++) {
                if (cache.has(objectHash({ operation: "getBlock", parameters: { srcBlock: srcBlocks[i], opts: {} } }))) {
                    result[i] = cache.get(objectHash({ operation: "getBlock", parameters: { srcBlock: srcBlocks[i], opts: {} } }));
                    cacheHit++;
                }
                else blockToFetch.push(srcBlocks[i]);
            }
            blockToFetch = [...new Set(blockToFetch)];
            let batchFetchResult;
            if (blockToFetch.length > 0) {
                batchFetchResult = await SyncronizedLogseq.DB.datascriptQueryBlocks(`
                [:find (pull ?b [*])
                :where
                [?b :block/uuid ?uuid]
                [(contains? #{${blockToFetch.map((block) => `#uuid "${block}" `)}} ?uuid)]
                ]`);
            }
            
            for (let i = 0, j = 0; i < srcBlocks.length && j < batchFetchResult.length; i++) {
                if(batchFetchResult[j][0] == null) continue;
                if (result[i] == null) {
                    result[i] = batchFetchResult[j][0];
                    j++;
                }
            }
            return result;
        }

        static async getPage(srcPage: PageIdentity | EntityID): Promise<PageEntity | null> {
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
    export class DB {
        static async datascriptQuery<T = any>(query: string, ...inputs: Array<any>):  Promise<T> {
            return logseq.DB.datascriptQuery(query, ...inputs);
        }

        static async datascriptQueryBlocks(query: string, ...inputs: Array<any>):  Promise<BlockEntity[]> {
            let result = await logseq.DB.datascriptQuery(query, ...inputs);
            for(let block of result) {
                block = block[0];
                if(block == null || block == undefined) continue;
                let uuid : BlockUUID = block.uuid["$uuid$"] || block.uuid.Wd || block.uuid || null;
                let dbid = block.id || null;
                if (uuid != null && !cache.has(objectHash({ operation: "getBlock", parameters: { srcBlock: uuid, opts: {} } })))
                    cache.set(objectHash({ operation: "getBlock", parameters: { srcBlock: uuid, opts: {} } }), block);
                if (dbid != null && !cache.has(objectHash({ operation: "getBlock", parameters: { srcBlock: dbid, opts: {} } })))
                    cache.set(objectHash({ operation: "getBlock", parameters: { srcBlock: dbid, opts: {} } }), block);
            }
            return result;
        }
    }
    export class Cache {
        static clear(): void {
            console.log("Cache Hit:" ,cacheHit);
            cacheHit = 0;
            cache.clear();
        }
        static has(key: LogSeqOperationHash): boolean {
            return cache.has(key);
        }
    }
}