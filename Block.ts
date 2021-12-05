import '@logseq/libs'
import { decodeHTMLEntities } from './utils';
import { Remarkable } from 'remarkable';
import * as AnkiConnect from './AnkiConnect';
import path from "path";

export abstract class Block {
    public uuid: string;
    public content: string;
    public page: any;
    public properties: any;
    public type: string;
    private ankiId: number;

    public constructor(uuid: string, content: string, properties: any, page: any) {
        this.uuid = uuid;
        this.content = content;
        this.properties = properties;
        this.page = page;
    }

    public abstract addClozes(): Block;

    public getContent(): string {
        return this.content;
    }

    public async getAnkiId(): Promise<number> {
        if (this.ankiId) return this.ankiId;

        let graphName = (await logseq.App.getCurrentGraph()).name;
        let modelName = `${graphName}Model`;
        this.ankiId = parseInt((await AnkiConnect.query(`uuid-type:${this.uuid}-${this.type} note:${modelName}`))[0]);
        console.log(this.ankiId);
        return this.ankiId;
    }

    public async convertToHtml(): Promise<Block> {
        let result = this.content;
        this.content = await Block.convertToHtml(result);
        return this;
    }

    public static async convertToHtml(content: string): Promise<string> {
        let result = content;

        // --- Convert some logseq markup to html ---
        result = result.replace(/^\s*(\w|-)*::.*/gm, "");  //Remove properties
        result = result.replace(/(?<!\$)\$((?=[\S])(?=[^$])[\s\S]*?\S)\$/g, "\\( $1 \\)"); // Convert inline math
        result = result.replace(/\$\$([\s\S]*?)\$\$/g, "\\[ $1 \\]"); // Convert block math
        result = result.replace(/#\+BEGIN_(INFO|PROOF)( .*)?\n((.|\n)*?)#\+END_\1/gi, function (match, g1, g2, g3) { // Remove proof, info org blocks
            return ``;
        });
        result = result.replace(/#\+BEGIN_(QUOTE)( .*)?\n((.|\n)*?)#\+END_\1/gi, function (match, g1, g2, g3) { // Convert quote org blocks
            return `<blockquote">${g3.trim()}</blockquote>`;
        });
        result = result.replace(/#\+BEGIN_(CENTER)( .*)?\n((.|\n)*?)#\+END_\1/gi, function (match, g1, g2, g3) { // Convert center org blocks
            return `<span class="text-center">${g3.trim()}</span>`; // div is buggy with remarkable
        });
        result = result.replace(/#\+BEGIN_(COMMENT)( .*)?\n((.|\n)*?)#\+END_\1/gi, function (match, g1, g2, g3) { // Remove comment org blocks
            return ``;
        });
        while (true) {  // Convert named org blocks recursively
            let oldres = result;
            result = result.replace(/#\+BEGIN_([^ \n]+)( .*)?\n((.|\n)*?)#\+END_\1/gi, function (match, g1, g2, g3) {
                return `<span class="${g1.toLowerCase()}">${g3.trim()}</span>`; // div is buggy with remarkable
            });
            if (oldres == result) break;
        }

        // --- Convert markdown to html ---
        result = result.replace(/\\/gi, "\\\\"); //Fix blackkslashes
        let remarkable = new Remarkable('full', {
            html: true,
            breaks: true,
            typographer: false,
        });
        remarkable.inline.ruler.disable(['sub', 'sup', 'ins']);
        remarkable.block.ruler.disable(['code']);
        const originalLinkValidator = remarkable.inline.validateLink;
        const dataLinkRegex = /^\s*data:([a-z]+\/[a-z]+(;[a-z-]+=[a-z-]+)?)?(;base64)?,[a-z0-9!$&',()*+,;=\-._~:@/?%\s]*\s*$/i;
        const isImage = /^.*\.(png|jpg|jpeg|bmp|tiff|gif|apng|svg|webp)$/i;
        const isWebURL = /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;
        remarkable.inline.validateLink = (url: string) => originalLinkValidator(url) || encodeURI(url).match(dataLinkRegex) || (encodeURI(url).match(isImage) && !encodeURI(url).match(isWebURL));
        const originalImageRender = remarkable.renderer.rules.image;
        let graphPath = (await logseq.App.getCurrentGraph()).path;
        remarkable.renderer.rules.image = (...a) => {
            if ((encodeURI(a[0][a[1]].src).match(isImage) && !encodeURI(a[0][a[1]].src).match(isWebURL))) { // Image is relative to vault
                let imgPath = path.join(graphPath, a[0][a[1]].src.replace(/^(\.\.\/)+/, ""));
                AnkiConnect.storeMediaFileByPath(encodeURIComponent(a[0][a[1]].src), imgPath); // Flatten and save
                a[0][a[1]].src = encodeURIComponent(a[0][a[1]].src); // Flatten image and convert to markdown.
            }
            return originalImageRender(...a);
        };
        result = remarkable.render(result);
        result = decodeHTMLEntities(result);

        return result;
    }
    // public static async abstract getBlocksFromLogseq(): Block[];
}