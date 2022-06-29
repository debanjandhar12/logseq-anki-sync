import '@logseq/libs'
import { LazyAnkiNoteManager } from '../anki-connect/LazyAnkiNoteManager';
import _ from 'lodash';
import { HTMLFile } from '../converter/Converter';
import { BlockUUID } from '@logseq/libs/dist/LSPlugin.user';
import getContentDirectDependencies, { PageEntityName } from '../converter/getContentDirectDependencies';
import { SyncronizedLogseq } from '../SyncronizedLogseq';
import pkg from '../../package.json';
import hashSum from 'hash-sum';

export abstract class Note {
    public uuid: string;
    public content: string;
    public format: string;
    public properties: any;
    public page: any;
    public type: string;
    public ankiId: number;
    static ankiNoteManager: LazyAnkiNoteManager;

    public constructor(uuid: string, content: string, format: string, properties: any, page: any) {
        this.uuid = uuid;
        this.content = content;
        this.format = format;
        this.properties = properties;
        this.page = page;
    }

    public static setAnkiNoteManager(ankiNoteManager: LazyAnkiNoteManager) {
        Note.ankiNoteManager = ankiNoteManager;
    }

    public abstract getClozedContentHTML(): Promise<HTMLFile>;

    public getContent(): string {
        return this.content;
    }

    public getAnkiId(): number {
        if (this.ankiId) return this.ankiId;
        let ankiNotesArr = Array.from(Note.ankiNoteManager.noteInfoMap.values());
        let filteredankiNotesArr = ankiNotesArr.filter((note) => note.fields["uuid-type"].value == `${this.uuid}-${this.type}`);
        if(filteredankiNotesArr.length == 0) this.ankiId = null;
        else this.ankiId = parseInt(filteredankiNotesArr[0].noteId);
        return this.ankiId;
    }

    public getDirectDeendencies(): BlockUUID[] {
        return [this.uuid];
    }

    public async getAllDependenciesHash(additionalDependencies = []): Promise<string> {
        let toHash = [...additionalDependencies];
        let blockDependencies : Set<BlockUUID> | BlockUUID[] = new Set<BlockUUID>();
        let pageDependencies : Set<PageEntityName> | PageEntityName[] = new Set<PageEntityName>();

        // DFS to get all dependencies
        let stack : (BlockUUID | PageEntityName)[] = this.getDirectDeendencies();
        let parentID = (await SyncronizedLogseq.Editor.getBlock(this.uuid)).parent.id;
        let parent;
        while ((parent = await SyncronizedLogseq.Editor.getBlock(parentID)) != null) {
            stack.push(parent.uuid["$uuid$"] || parent.uuid.Wd || parent.uuid);
            parentID = parent.parent.id;
        }
        while (stack.length > 0) {
            if(stack.at(-1) instanceof PageEntityName) {pageDependencies.add(stack.pop() as PageEntityName); continue;}
            let uuid = stack.pop() as BlockUUID;
            if (blockDependencies.has(uuid)) continue;
            blockDependencies.add(uuid);
            let block = await SyncronizedLogseq.Editor.getBlock(uuid);
            stack.push(...getContentDirectDependencies(_.get(block, 'content',''), _.get(block, 'format','')));
        }
        blockDependencies = _.sortBy(Array.from(blockDependencies));
        
        for (let uuid of blockDependencies) {
            let block = await SyncronizedLogseq.Editor.getBlock(uuid);
            toHash.push({content:_.get(block, 'content',''), format:_.get(block, 'format','markdown'), parent:_.get(block, 'parent.id',''), left:_.get(block, 'left.id','')});
        }
        pageDependencies = _.sortBy(Array.from(pageDependencies));
        for (let PageEntityName of pageDependencies) {
            let page = await SyncronizedLogseq.Editor.getPage(PageEntityName.name);
            toHash.push({content:_.get(page, 'updatedAt','')});
        }
        toHash.push({page:encodeURIComponent(_.get(this, 'page.originalName', '')), deck:encodeURIComponent(_.get(this, 'page.properties.deck', ''))});
        toHash.push({defaultDeck:logseq.settings.defaultDeck, includeParentContent: logseq.settings.includeParentContent, breadcrumbDisplay: logseq.settings.breadcrumbDisplay});
        toHash.push({v:pkg.version});
        return hashSum(toHash); // hashSum is faster than objectHash but collisions rate is high (here, it suits our case of detecting changes)
    }

    // public static async abstract getBlocksFromLogseq(): Block[];
}
