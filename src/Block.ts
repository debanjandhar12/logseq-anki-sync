import '@logseq/libs'
import * as AnkiConnect from './AnkiConnect';
import _ from 'lodash';
import * as Converter from './Converter';

export abstract class Block {
    public uuid: string;
    public content: string;
    public format: string;
    public properties: any;
    public page: any;
    public type: string;
    private ankiId: number;

    public constructor(uuid: string, content: string, format: string, properties: any, page: any) {
        this.uuid = uuid;
        this.content = content;
        this.format = format;
        this.properties = properties;
        this.page = page;
        console.log("Hehe2"+format);
    }

    public abstract addClozes(): Block;

    public getContent(): string {
        return this.content;
    }

    public async getAnkiId(): Promise<number> {
        if (this.ankiId) return this.ankiId;

        let graphName = _.get(await logseq.App.getCurrentGraph(), 'name') || 'Default';
        let modelName = `${graphName}Model`.replace(/\s/g, "_");
        this.ankiId = parseInt((await AnkiConnect.query(`uuid-type:${this.uuid}-${this.type} note:${modelName}`))[0]);
        console.log(this.ankiId);
        return this.ankiId;
    }

    public async convertToHtml(): Promise<Block> {
        this.content = await Converter.convertToHtml(this.content, this.format);
        return this;
    }

    // public static async abstract getBlocksFromLogseq(): Block[];
}