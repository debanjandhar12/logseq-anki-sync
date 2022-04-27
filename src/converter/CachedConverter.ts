/**
 * This class is used to cache the results of Converter.ts in IndexedDB.
 */
import localforage from 'localforage';
import objectHash from 'object-hash';
import { convertToHTMLFile as convertToHTMLFileNonCached, HTMLFile } from './Converter';
export { HTMLFile } from './Converter';

const cacheVersion = 2050000;

localforage.config({
    driver: localforage.INDEXEDDB
});

localforage.getItem('cacheVersion').then((version) => {
    if (version !== cacheVersion || Math.floor(Math.random() * 600) == 500) {
        console.log('Cache version changed, clearing conversion cache');
        localforage.clear();
        localforage.setItem('cacheVersion', cacheVersion);
    }
});

export async function convertToHTMLFile(content: string, format: string = "markdown"): Promise<HTMLFile> {
    if((await localforage.getItem(objectHash({ content, format })) != null)) {
        let {html, assets} = JSON.parse(await localforage.getItem(objectHash({ content, format })));
        assets = new Set(assets);
        return {html, assets};
    }
    let {html, assets} = await convertToHTMLFileNonCached(content, format);
    try { localforage.setItem(objectHash({ content, format }), JSON.stringify({html, assets: [...assets]})); }
    catch(e) { console.log(e); }
    return {html, assets};
}