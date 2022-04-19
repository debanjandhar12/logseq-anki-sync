/**
 * This class is used to cache the results of Converter.ts in IndexedDB.
 */
import localforage from 'localforage';
import objectHash from 'object-hash';
import { convertToHTMLFile as convertToHTMLFileNonCached, HTMLFile } from './Converter';
export { HTMLFile } from './Converter';

const cacheVersion = 14;

localforage.config({
    driver: localforage.INDEXEDDB
});

localforage.getItem('cacheVersion').then((version) => {
    if (version !== cacheVersion) {
        console.log('Cache version changed, clearing conversion cache');
        localforage.clear();
        localforage.setItem('cacheVersion', cacheVersion);
    }
});

export async function convertToHTMLFile(content: string, format: string = "markdown"): Promise<HTMLFile> {
    if((await localforage.getItem(objectHash({ content, format })) != null)) {
        let {html, assets} = JSON.parse(await localforage.getItem(objectHash({ content, format })));
        assets = new Set(assets);
        // console.log(assets); - uncomment to solve a bug with assets not being included
        return {html, assets};
    }
    let {html, assets} = await convertToHTMLFileNonCached(content, format);
    localforage.setItem(objectHash({ content, format }), JSON.stringify({html, assets: [...assets]}));
    return {html, assets};
}