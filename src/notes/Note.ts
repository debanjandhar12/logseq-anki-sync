import '@logseq/libs'
import { LazyAnkiNoteManager } from '../anki-connect/LazyAnkiNoteManager';
import _, { replace } from 'lodash';
import { HTMLFile } from '../converter/Converter';
import { BlockUUID } from '@logseq/libs/dist/LSPlugin.user';
import getContentDirectDependencies, { PageEntityName, ReferenceDependency } from '../converter/getContentDirectDependencies';
import { LogseqProxy } from '../LogseqProxy';
import pkg from '../../package.json';
import hashSum from 'hash-sum';
import { MD_PROPERTIES_REGEXP, ORG_PROPERTIES_REGEXP } from '../constants';
import { getFirstNonEmptyLine } from '../utils';
import { getBlockRecursiveDependenciesHash } from '../converter/getBlockRecursiveDependenciesHash';

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

    public getDirectDependencies(): ReferenceDependency[] {
        return [this.uuid].map(block => ({ type: "Embedded_Block_ref", value: block } as ReferenceDependency));
    }

    public async getAllDependenciesHash(additionalDependencies = []): Promise<string> {
        let toHash = [...additionalDependencies];

        // Collect parent And DirectDependencies
        let parentAndDirectDependencies : ReferenceDependency[] = this.getDirectDependencies();
        let parentID = (await LogseqProxy.Editor.getBlock(this.uuid)).parent.id;
        let parent;
        while ((parent = await LogseqProxy.Editor.getBlock(parentID)) != null) {
            let blockUUID = parent.uuid["$uuid$"] || parent.uuid.Wd || parent.uuid || parent.parent.id;
            if(logseq.settings.includeParentContent) 
                parentAndDirectDependencies.push({ type: "Embedded_Block_ref", value: blockUUID } as ReferenceDependency);
            else parentAndDirectDependencies.push({ type: "Block_ref", value: blockUUID } as ReferenceDependency);
            parentID = parent.parent.id;
        }

        // Call getBlockRecursiveDependenciesHash on parentAndDirectDependencies and add them to toHash
        for(let dep of parentAndDirectDependencies) {
            toHash.push(await getBlockRecursiveDependenciesHash(dep));
        };

        // Add additional things to toHash
        toHash.push({page:encodeURIComponent(_.get(this, 'page.originalName', '')), deck:encodeURIComponent(_.get(this, 'page.properties.deck', ''))});
        toHash.push({defaultDeck:logseq.settings.defaultDeck, includeParentContent: logseq.settings.includeParentContent, breadcrumbDisplay: logseq.settings.breadcrumbDisplay});
        toHash.push({v:pkg.version});

        // Return hash
        return hashSum(toHash);
    }
    // public static async abstract getBlocksFromLogseq(): Block[];
}
