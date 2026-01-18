/***
 * This is a cached + syncronization-safe logseq api wrapper.
 * Fixes the following issues: #58
 * */
import "@logseq/libs";
import {
    BlockEntity,
    BlockIdentity,
    BlockUUID,
    EntityID,
    PageEntity,
    PageIdentity, PropertySchema,
    SettingSchemaDesc,
} from "@logseq/libs/dist/LSPlugin";
import AwaitLock from "await-lock";
import { PluginSettings } from "../settings";
import pMemoize, {pMemoizeClear} from "p-memoize";
import objectHashOptimized from "../utils/objectHashOptimized";
import {WindowParentBridge} from "./WindowParentBridge";
import { LogseqPropertiesHelper } from "./LogseqPropertiesHelper";
import { LogseqNamespaceHelperProxy } from "./LogseqNamespaceHelper";
import getNameFromPage from "./getNameFromPage";

const getLogseqLock = new AwaitLock();

export namespace LogseqProxy {
    export class Editor {
        static getBlock = pMemoize(async (
            srcBlock: BlockIdentity | EntityID,
            opts: Partial<{includeChildren: boolean, suppressErrors: boolean}> = {suppressErrors: true}
        ): Promise<BlockEntity | null> => {
            srcBlock = typeof srcBlock === "string" ? srcBlock.toLowerCase() : srcBlock; // Convert to lowercase to avoid case sensitivity issues
            let block = null;
            await getLogseqLock.acquireAsync();
            try {
                block = await LogseqPropertiesHelper.getBlock(srcBlock, opts);
            } catch (e) {
                console.error(e);
                if (!opts.suppressErrors) throw e;
            } finally {
                getLogseqLock.release();
            }
            return block;
        }, {cacheKey: arguments_ => objectHashOptimized(arguments_)});

        static getPage = pMemoize(async (srcPage: PageIdentity | EntityID, opts: Partial<{suppressErrors: boolean}> = {suppressErrors: true}): Promise<PageEntity | null> => {
            srcPage = typeof srcPage === "string" ? srcPage.toLowerCase() : srcPage; // Convert to lowercase to avoid case sensitivity issues
            let page = null;
            await getLogseqLock.acquireAsync();
            try {
                // Use helper method to fetch page with properties
                page = await LogseqPropertiesHelper.getPage(srcPage);
            } catch (e) {
                console.error(e);
                if (!opts.suppressErrors) throw e;
            } finally {
                getLogseqLock.release();
            }
            return page;
        }, {cacheKey: arguments_ => objectHashOptimized(arguments_)});

        static getPageBlocksTree = pMemoize(async (srcPage: PageIdentity | EntityID, opts: Partial<{suppressErrors: boolean}> = {suppressErrors: true}): Promise<BlockEntity[]> => {
            srcPage = typeof srcPage === "string" ? srcPage.toLowerCase() : srcPage; // Convert to lowercase to avoid case sensitivity issues
            let pageBlockTree = [];
            await getLogseqLock.acquireAsync();
            try {
                pageBlockTree = await LogseqPropertiesHelper.getPageBlocksTree(srcPage);
            } catch (e) {
                console.error(e);
                if (!opts.suppressErrors) throw e;
            } finally {
                getLogseqLock.release();
            }
            return pageBlockTree;
        }, {cacheKey: arguments_ => objectHashOptimized(arguments_)});

        static getParentNamespacePages = pMemoize(async (
            page: PageEntity | null | undefined,
            opts: Partial<{suppressErrors: boolean}> = {suppressErrors: true}
        ): Promise<PageEntity[]> => {
            if (!page) return [];
            // we do not acquire lock here as LogseqNamespaceHelperProxy.getParentNamespacePages
            // uses LogseqProxy.Editor.getPage which has separate lock
            try {
                return await LogseqNamespaceHelperProxy.getParentNamespacePages(page);
            } catch (e) {
                console.error(e);
                if (!opts.suppressErrors) throw e;
            }
            return [];
        }, {cacheKey: arguments_ => objectHashOptimized(arguments_)});

        static getFullPageName = pMemoize(async (
            page: PageEntity | null | undefined,
            opts: Partial<{suppressErrors: boolean}> = {suppressErrors: true}
        ): Promise<string> => {
            if (!page) return "";
            await getLogseqLock.acquireAsync();
            try {
                const isDb = await LogseqProxy.App.checkCurrentIsDbGraph();
                const baseName = getNameFromPage(page) || "";

                if (!isDb) {
                    return baseName;
                }

                const parents = await LogseqProxy.Editor.getParentNamespacePages(page);
                if (parents.length === 0) {
                    return baseName;
                }

                const segments = [
                    ...parents.reverse().map(p => getNameFromPage(p)),
                    baseName
                ];
                return segments.filter(s => !!s).join("/");
            } catch (e) {
                console.error(e);
                if (!opts.suppressErrors) throw e;
            } finally {
                getLogseqLock.release();
            }
            return "";
        }, {cacheKey: arguments_ => objectHashOptimized(arguments_)});

        static async upsertBlockProperty(block: BlockIdentity,
            key: string, value: any, opts: Partial<{suppressErrors: boolean}> = {suppressErrors: true}) {
            await getLogseqLock.acquireAsync();
            try {
                await logseq.Editor.upsertBlockProperty(block, key, value);
            } catch (e) {
                console.error(e);
                if (!opts.suppressErrors) throw e;
            } finally {
                getLogseqLock.release();
            }
        }

        static async createTagSilentlyIfNotExists(tagName: string) {
            await getLogseqLock.acquireAsync();
            try {
                // Handle both DB ver and File ver
                // In File ver, tags are same as pages
                // In DB ver, internally tags are pages
                // with a tag #Tag but api wise considered different
                const isDb = await logseq.App.checkCurrentIsDbGraph();
                const exists = isDb
                    ? await logseq.Editor.getTag(tagName)
                    : await logseq.Editor.getPage(tagName);

                if (!exists) {
                    isDb
                        ? await logseq.Editor.createTag(tagName)
                        : await logseq.Editor.createPage(tagName, {}, { redirect: false });
                }
            } catch (e) {
                console.error(e);
            } finally {
                getLogseqLock.release();
            }
        }

        static async registerProperty(key: string, schema?: Partial<PropertySchema>) {
            await getLogseqLock.acquireAsync();
            try {
                const isDb = await logseq.App.checkCurrentIsDbGraph();
                if (!isDb) return; // upsertProperty does not work in non db version
                await logseq.Editor.upsertProperty(key, schema);
            } catch (e) {
                console.error(e);
            } finally {
                getLogseqLock.release();
            }
        }
    }
    export class DB {
        static async datascriptQuery<T = any>(
            query: string, opts: Partial<{suppressErrors: boolean}> = {suppressErrors: true}): Promise<T> {
            let result;
            await getLogseqLock.acquireAsync();
            try {
                result = await logseq.DB.datascriptQuery(query);
            } catch (e) {
                console.error(e);
                if (!opts.suppressErrors) throw e;
            } finally {
                getLogseqLock.release();
            }
            return result;
        }

        static registeredDBListeners: Array<(event: {blocks: any[]; txData: any; txMeta: any}) => void> = [];
        static registerDBChangeListener(
            listener: (event: {blocks: any[]; txData: any; txMeta: any}) => void,
        ): void {
            this.registeredDBListeners.push(listener);
        }
    }
    export class Settings {
        static useSettingsSchema(schemas: Array<SettingSchemaDesc>): void {
            logseq.useSettingsSchema(schemas);
        }

        static registeredSettingsChangeListeners: Array<(newSettings: PluginSettings, oldSettings: PluginSettings) => void> = [];
        static registerSettingsChangeListener(
            listener: (newSettings: PluginSettings, oldSettings: PluginSettings) => void,
        ): void {
            this.registeredSettingsChangeListeners.push(listener);
        }

        static getPluginSettings(): PluginSettings {
            return logseq.settings as PluginSettings;
        }
    }
    export class Assets {
        static listFilesOfCurrentGraph = pMemoize(async (exts?: string | string[]): Promise<{
            accessTime: number;
            birthTime: number;
            changeTime: number;
            modifiedTime: number;
            path: string;
            size: number;
        }[]> => {
            let files = [];
            await getLogseqLock.acquireAsync();
            try {
                files = await logseq.Assets.listFilesOfCurrentGraph(exts);
            } catch (e) {
                console.error(e);
            } finally {
                getLogseqLock.release();
            }
            return files;
        }, {cacheKey: arguments_ => objectHashOptimized(arguments_)});
    }
    export class App {
        static checkCurrentIsDbGraph = pMemoize(async () => {
            try {
                return await logseq.App.checkCurrentIsDbGraph()
            } catch (e) {}
            return false;
        });

        static getCurrentGraph = pMemoize(async () => {
            return await logseq.App.getCurrentGraph();
        });

        static registeredGraphChangeListeners: Array<(e: any) => void> = [];
        static registerGraphChangeListener(listener: (e: any) => void): void {
            this.registeredGraphChangeListeners.push(listener);
        }

        static registerPluginUnloadListeners: Array<() => void> = [];
        static registerPluginUnloadListener(listener: () => void): void {
            this.registerPluginUnloadListeners.push(listener);
        }
    }
    export function init() {
        logseq.DB.onChanged(async ({blocks, txData, txMeta}) => {
            for (const listener of LogseqProxy.DB.registeredDBListeners) {
                listener({blocks: [...blocks], txData, txMeta});
            }
        });
        logseq.onSettingsChanged((newSettings, oldSettings) => {
            for (const listener of LogseqProxy.Settings.registeredSettingsChangeListeners) {
                listener(newSettings, oldSettings);
            }
        });
        logseq.App.onCurrentGraphChanged((e) => {
            for (const listener of LogseqProxy.App.registeredGraphChangeListeners) {
                listener(e);
            }
        });
        logseq.beforeunload(async () => {
            for (const listener of LogseqProxy.App.registerPluginUnloadListeners) {
                listener();
            }
        });
        WindowParentBridge.addEventListener("syncLogseqToAnkiComplete", () => {
            const { debug } = LogseqProxy.Settings.getPluginSettings();
            if (debug?.includes("LogseqProxy.ts")) {
                console.log("[LogseqProxy] Clearing memoization caches for getBlock, getPage, getPageBlocksTree, namespace helpers, listFilesOfCurrentGraph, and checkCurrentIsDbGraph");
            }
            pMemoizeClear(LogseqProxy.Editor.getBlock);
            pMemoizeClear(LogseqProxy.Editor.getPage);
            pMemoizeClear(LogseqProxy.Editor.getPageBlocksTree);
            pMemoizeClear(LogseqProxy.Editor.getParentNamespacePages);
            pMemoizeClear(LogseqProxy.Editor.getFullPageName);
            pMemoizeClear(LogseqProxy.Assets.listFilesOfCurrentGraph);
            pMemoizeClear(LogseqProxy.App.checkCurrentIsDbGraph);
            pMemoizeClear(LogseqProxy.App.getCurrentGraph);
        });
    }
}