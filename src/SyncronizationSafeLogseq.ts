import { BlockEntity, BlockIdentity, EntityID, PageIdentity } from "@logseq/libs/dist/LSPlugin";
import AwaitLock from "await-lock";
/***
 * Syncronization-safe logseq api wrapper for the Logseq plugin
 * */

let getLogseqLock = new AwaitLock();
export namespace SyncronizationSafeLogseq {
    export class Editor {
        static async getBlock(srcBlock: BlockIdentity | EntityID, opts?: Partial<{ includeChildren: boolean; }>): Promise<BlockEntity | null> {
            let block = null;
            await getLogseqLock.acquireAsync();
            try {block = await logseq.Editor.getBlock(srcBlock, opts);}
            catch(e) { console.error(e); }
            finally { getLogseqLock.release(); }
            return block;
        }
    
        static async getPage(srcPage: PageIdentity | EntityID): Promise<PageIdentity | null> {
            let page = null;
            await getLogseqLock.acquireAsync();
            try {page = await logseq.Editor.getPage(srcPage);}
            catch(e) { console.error(e); }
            finally { getLogseqLock.release(); }
            return page;
        }
    
        static async getPageBlocksTree(srcPage: PageIdentity): Promise<Array<BlockEntity>> {
            let pageBlockTree = null;
            await getLogseqLock.acquireAsync();
            try {pageBlockTree = await logseq.Editor.getPageBlocksTree(srcPage);}
            catch(e) { console.error(e); }
            finally { getLogseqLock.release(); }
            return pageBlockTree;
        }
    
        static async upsertBlockProperty(block: BlockIdentity, key: string, value: any): Promise<void> {
            await getLogseqLock.acquireAsync();
            try {await logseq.Editor.upsertBlockProperty(block, key, value);}
            catch(e) { console.error(e); }
            finally { getLogseqLock.release(); }
        }    
    }
}