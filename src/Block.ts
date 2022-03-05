import '@logseq/libs'
import * as AnkiConnect from './AnkiConnect';
import { LazyAnkiNoteManager } from './LazyAnkiNoteManager';
import _ from 'lodash';
import * as Converter from './Converter';

export abstract class Block {
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
        console.log("Hehe2"+format);
    }

    public static setAnkiNoteManager(ankiNoteManager: LazyAnkiNoteManager) {
        Block.ankiNoteManager = ankiNoteManager;
    }

    public abstract addClozes(): Block;

    public getContent(): string {
        return this.content;
    }

    public async getAnkiId(): Promise<number> {
        if (this.ankiId) return this.ankiId;
        let ankiNotesArr = Array.from(Block.ankiNoteManager.noteInfoMap.values());
        let filteredankiNotesArr = ankiNotesArr.filter((note) => note.fields["uuid-type"].value == `${this.uuid}-${this.type}`);
        if(filteredankiNotesArr.length == 0) this.ankiId = null;
        else this.ankiId = parseInt(filteredankiNotesArr[0].noteId);
        return this.ankiId;
    }

    public async convertToHtml(): Promise<Block> {
        this.content = await Converter.convertToHtml(this.content, this.format);
        return this;
    }

    // public static async abstract getBlocksFromLogseq(): Block[];
}