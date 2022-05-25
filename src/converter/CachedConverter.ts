/**
 * This class is used to cache the results of Converter.ts in IndexedDB.
 */
import localforage from 'localforage';
import objectHash from 'object-hash';
import { LOGSEQ_BLOCK_REF_REGEXP, LOGSEQ_EMBDED_BLOCK_REGEXP } from '../constants';
import { convertToHTMLFile as convertToHTMLFileNonCached, HTMLFile } from './Converter';
export { HTMLFile } from './Converter';
import pkg from '../../package.json';

localforage.config({
    driver: localforage.INDEXEDDB
});

localforage.getItem('cacheVersion').then((version) => {
    if (version !== pkg.version || Math.floor(Math.random() * 100) == 50) {
        console.log('Cache version changed, clearing conversion cache. It could be random aswell.');
        localforage.clear();
        localforage.setItem('cacheVersion', pkg.version);
    }
});

logseq.onSettingsChanged((newSettings,oldSettings) => {
    if(newSettings.useCacheForConversion !== oldSettings.useCacheForConversion) {
        console.log('Cache settings changed, clearing conversion cache');
        localforage.clear();
        localforage.setItem('cacheVersion', pkg.version)
    }
});

export async function convertToHTMLFile(content: string, format: string = "markdown"): Promise<HTMLFile> {
    let canCacheBeUsed = !(LOGSEQ_EMBDED_BLOCK_REGEXP.test(content) || LOGSEQ_BLOCK_REF_REGEXP.test(content));
    if(canCacheBeUsed && logseq.settings.useCacheForConversion && (await localforage.getItem(objectHash({ content, format })) != null)) {
        let {html, assets} = JSON.parse(await localforage.getItem(objectHash({ content, format })));
        assets = new Set(assets);
        return {html, assets};
    }
    let {html, assets} = await convertToHTMLFileNonCached(content, format);
    if(canCacheBeUsed && logseq.settings.useCacheForConversion) {
        try { localforage.setItem(objectHash({ content, format }), JSON.stringify({html, assets: [...assets]})); }
        catch(e) { console.log(e); }
    }
    return {html, assets};
}