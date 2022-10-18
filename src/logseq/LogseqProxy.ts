import '@logseq/libs'
import {
    BlockEntity,
    BlockIdentity,
    BlockUUID,
    EntityID,
    PageEntity,
    PageIdentity,
    SettingSchemaDesc
} from "@logseq/libs/dist/LSPlugin";
import AwaitLock from "await-lock";
import objectHash from "object-hash";
import _ from "lodash";
import {AddonRegistry} from "../addons/AddonRegistry";
/***
 * This is a Cached + Syncronization-safe logseq api wrapper. 
 * Fixes the following issues: #58
 * */

type LogSeqOperation = {
    operation: String,
    parameters: any
}
type LogSeqOperationHash = string;

let cache = new Map<LogSeqOperationHash, any>();
let getLogseqLock = new AwaitLock();

export namespace LogseqProxy {
    export class Editor {
        static async getBlock(srcBlock: BlockIdentity | EntityID, opts: Partial<{ includeChildren: boolean; }> = {}): Promise<BlockEntity | null> {
            if (cache.has(objectHash({ operation: "getBlock", parameters: { srcBlock, opts } })))
                return cache.get(objectHash({ operation: "getBlock", parameters: { srcBlock, opts } }));
            if (cache.has(objectHash({ operation: "getBlock", parameters: { srcBlock, opts:_.extend({includeChildren:true},opts) } }))) // Return includeChildren one if available
                return cache.get(objectHash({ operation: "getBlock", parameters: { srcBlock, opts:_.extend({includeChildren:true},opts) } }));
            let block = null;
            await getLogseqLock.acquireAsync();
            try {
                block = await logseq.Editor.getBlock(srcBlock, opts);
                cache.set(objectHash({ operation: "getBlock", parameters: { srcBlock , opts } }), block);
                let uuid : BlockUUID = null, dbid = null;
                if(block) {
                    uuid = block.uuid["$uuid$"] || block.uuid.Wd || block.uuid || null;
                    dbid = block.id || null;
                }
                if (block && uuid != null) 
                    cache.set(objectHash({ operation: "getBlock", parameters: { srcBlock: uuid, opts } }), block);
                if (block && dbid != null)
                    cache.set(objectHash({ operation: "getBlock", parameters: { srcBlock: dbid, opts } }), block);

                if(block && opts && opts.includeChildren) {
                    let stack = [...block.children];
                    while (stack.length > 0) {
                        let child = stack.pop();
                        if (child == null) continue;
                        let uuid : BlockUUID = child.uuid["$uuid$"] || child.uuid.Wd || child.uuid || null;
                        let dbid = child.id || null;
                        if (uuid != null) 
                            cache.set(objectHash({ operation: "getBlock", parameters: { srcBlock: uuid, opts } }), child);
                        if (dbid != null)
                            cache.set(objectHash({ operation: "getBlock", parameters: { srcBlock: dbid, opts } }), child);
                        stack.push(...child.children);
                    }
                }
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
                }
                else blockToFetch.push(srcBlocks[i]);
            }
            blockToFetch = [...new Set(blockToFetch)];
            let batchFetchResult;
            if (blockToFetch.length > 0) {
                batchFetchResult = await LogseqProxy.DB.datascriptQueryBlocks(`
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
        static async datascriptQuery<T = any>(query: string, ...inputs: Array<any>): Promise<T> {
            let result;
            await getLogseqLock.acquireAsync();
            try { result = await logseq.DB.datascriptQuery(query, ...inputs); }
            catch (e) { console.error(e); }
            finally { getLogseqLock.release(); }
            return result;
        }

        static async datascriptQueryBlocks(query: string, ...inputs: Array<any>):  Promise<BlockEntity[]> {
            let result = [];
            await getLogseqLock.acquireAsync();
            try { 
                result = await logseq.DB.datascriptQuery(query, ...inputs);
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
             }
            catch (e) { console.error(e); }
            finally { getLogseqLock.release(); }
            return result;
        }

        static registeredDBListeners = [];
        static registerDBChangeListener(listener: (event: {blocks, txData, txMeta}) => void): void {
            this.registeredDBListeners.push(listener);
        }
    }
    export class Settings {
        static useSettingsSchema(schemas: Array<SettingSchemaDesc>): void {
            logseq.useSettingsSchema(schemas);
        }

        static registeredSettingsChangeListeners = [];
        static registerSettingsChangeListener(listener: (newSettings, oldSettings) => void): void {
            this.registeredSettingsChangeListeners.push(listener);
        }
    }
    export class Cache {
        static clear(): void {
            if(!logseq.settings.activeCacheForLogseqAPIv0) cache.clear();
        }

        static has(key: LogSeqOperationHash): boolean {
            return cache.has(key);
        }
    }
    export function init() {
        logseq.DB.onChanged(async ({blocks, txData, txMeta}) => {
            for (let listener of LogseqProxy.DB.registeredDBListeners) {
                listener({blocks: [...blocks], txData, txMeta});
            }
        });
        logseq.onSettingsChanged((newSettings, oldSettings) => {
            for (let listener of LogseqProxy.Settings.registeredSettingsChangeListeners) {
                listener(newSettings, oldSettings);
            }
        });
        LogseqProxy.DB.registerDBChangeListener(async ({blocks, txData, txMeta}) => {
            if (!logseq.settings.cacheLogseqAPIv1) { LogseqProxy.Cache.clear(); return;}
            console.log("Maintaining LogseqProxy.ts cache");
            for(let tx of txData) {
                let [txBlockID, txType, ...additionalDetails] = tx;
                if(txType != "left" && txType != "parent") continue;
                let block = await LogseqProxy.Editor.getBlock(txBlockID);
                if(block != null) blocks.push(block);
                block = await LogseqProxy.Editor.getBlock(additionalDetails[0]);
                if(block != null) blocks.push(block);
            }
            let blockVisited = new Set();
            while (blocks.length > 0) {
                let block = blocks.pop();
                if(blockVisited.has(block.id)) continue;
                blockVisited.add(block.id);
                block.uuid = _.get(block, "uuid['$uuid$']", null) || _.get(block, "uuid.Wd", null) || _.get(block, "uuid", null) || null;
                if (block.uuid != null) {
                    cache.delete(objectHash({ operation: "getBlock", parameters: { srcBlock: block.uuid, opts: {} } }));
                    cache.delete(objectHash({ operation: "getBlock", parameters: { srcBlock: block.uuid, opts: {includeChildren:true} } }));
                    cache.delete(objectHash({ operation: "getPage", parameters: { srcPage: block.uuid } }));
                    cache.delete(objectHash({ operation: "getPageBlocksTree", parameters: { srcPage: block.uuid } }));
                }
                if (block.page != null && block.page.id != null) {
                    cache.delete(objectHash({ operation: "getPage", parameters: { srcPage: block.page.id } }));
                    cache.delete(objectHash({ operation: "getPageBlocksTree", parameters: { srcPage: block.page.id } }));
                    let page_originalName = await LogseqProxy.Editor.getPage(block.page.id);
                    if (page_originalName != null) {
                        cache.delete(objectHash({ operation: "getPage", parameters: { srcPage: page_originalName } }));
                        cache.delete(objectHash({ operation: "getPageBlocksTree", parameters: { srcPage: page_originalName } }));
                    }
                }
                if(block.originalName != null) {
                    cache.delete(objectHash({ operation: "getPage", parameters: { srcPage: block.originalName } }));
                    cache.delete(objectHash({ operation: "getPageBlocksTree", parameters: { srcPage: block.originalName } }));
                }
                if (block.id != null) {
                    cache.delete(objectHash({ operation: "getBlock", parameters: { srcBlock: block.id, opts: {includeChildren:true} } }));
                    cache.delete(objectHash({ operation: "getBlock", parameters: { srcBlock: block.id, opts: {} } }));
                    cache.delete(objectHash({ operation: "getPage", parameters: { srcPage: block.id } }));
                    cache.delete(objectHash({ operation: "getPageBlocksTree", parameters: { srcPage: block.id } }));
                }
                if (block.parent != null && block.parent.id != null) {
                    let block_parent = await LogseqProxy.Editor.getBlock(block.parent.id);
                    if (block_parent != null)
                        blocks.push(block_parent);
                }
            }
        });
        LogseqProxy.Settings.registerSettingsChangeListener((newSettings, oldSettings) => {
            if (!newSettings.cacheLogseqAPIv1) LogseqProxy.Cache.clear();
        });
    }
}

