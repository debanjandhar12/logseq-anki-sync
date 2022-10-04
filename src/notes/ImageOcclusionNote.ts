import { Note } from "./Note";
import '@logseq/libs'
import { escapeClozeAndSecoundBrace, safeReplace } from '../utils';
import _ from 'lodash';
import {MD_IMAGE_EMBEDED_REGEXP, MD_PROPERTIES_REGEXP, ORG_PROPERTIES_REGEXP} from "../constants";
import { LogseqProxy } from "../LogseqProxy";
import { convertToHTMLFile, HTMLFile } from "../converter/Converter";
import {SelectPrompt} from "../ui/SelectPrompt";
import {OcclusionEditor} from "../ui/OcclusionEditor";

export class ImageOcclusionNote extends Note {
    public type: string = "image_occlusion";

    public constructor(uuid: string, content: string, format: string, properties: any, page: any) {
        super(uuid, content, format, properties, page);
    }

    public static initLogseqOperations = (() => {
        logseq.Editor.registerBlockContextMenuItem("Image Occlusion", async (block) => {
            console.log("Image Occlusion", block);
            let uuid = block.uuid["$uuid$"] || block.uuid.Wd || block.uuid || null;
            block = await LogseqProxy.Editor.getBlock(uuid);
            let content = block.content;
            let images = content.match(MD_IMAGE_EMBEDED_REGEXP).map((image) => {
                return image.replace(MD_IMAGE_EMBEDED_REGEXP, "$1");
            });

            let savedOcclusionHashMap = JSON.parse(Buffer.from(block.properties?.occlusion || Buffer.from("{}", 'utf8').toString('base64'), 'base64').toString());
            console.log("savedOcclusionHashMap", savedOcclusionHashMap);
            let selectedImage = await SelectPrompt("Select Image to add / update occlusion", images);
            if (selectedImage) {
                let oculsionInfo = await OcclusionEditor(selectedImage, savedOcclusionHashMap[selectedImage] || "");
                if (oculsionInfo) {
                    savedOcclusionHashMap[selectedImage] = oculsionInfo;
                    await LogseqProxy.Editor.upsertBlockProperty(uuid, 'occlusion', Buffer.from(JSON.stringify(savedOcclusionHashMap), 'utf8').toString('base64'));
                }
            }
        });
    });

    public async getClozedContentHTML(): Promise<HTMLFile> {
        let clozedContent : string = this.content;
        let clozes = new Set();
        let savedOcclusionHashMap = JSON.parse(Buffer.from(this.properties?.occlusion, 'base64').toString());
        let nonBase64OcclusionHashMap  = {};
        // Iterate through all images
        for(let image in savedOcclusionHashMap) {
            let occlusions = JSON.parse(Buffer.from(savedOcclusionHashMap[image], 'base64').toString());
            nonBase64OcclusionHashMap[image] = occlusions;
            let blockImages = this.content.match(MD_IMAGE_EMBEDED_REGEXP).map((image) => {
                return image.replace(MD_IMAGE_EMBEDED_REGEXP, "$1");
            });
            if(blockImages.includes(image)) {
                for (let occlusion of occlusions) {
                    clozes.add(occlusion.cId);
                }
            }
        }
        clozedContent += `\n<div class="hidden">
        ${Array.from(clozes).map((cloze) => `{{c${cloze}:: ::<span id="c${cloze}"></span>}}`).join('')}
        <div id="occlusionDataHashMap">${JSON.stringify(nonBase64OcclusionHashMap)}</div>
        </div>`;
        return convertToHTMLFile(clozedContent, this.format);
    }

    public static async getNotesFromLogseqBlocks(): Promise<ImageOcclusionNote[]> {
        let blocks: any = await LogseqProxy.DB.datascriptQuery(`
        [:find (pull ?b [*])
        :where
          [?b :block/properties ?p]
          [(get ?p :occlusion)]
        ]`);
        blocks = await Promise.all(blocks.map(async (block) => {
            let uuid = block[0].uuid["$uuid$"] || block[0].uuid.Wd || block[0].uuid;
            let page = (block[0].page) ? await LogseqProxy.Editor.getPage(block[0].page.id) : {};
            block = block[0];
            if(!block.content) {
                block = await LogseqProxy.Editor.getBlock(uuid);
            }
            if(block)
                return new ImageOcclusionNote(uuid, block.content, block.format, block.properties || {}, page);
            else {
                return null;
            }
        }));
        console.log("ImageOcclusionNote Loaded");
        blocks = _.uniqBy(blocks, 'uuid');
        blocks = _.without(blocks, undefined, null);
        blocks = _.filter(blocks, (block) => { // Remove template cards
            return _.get(block, 'properties.template') == null || _.get(block, 'properties.template') == undefined;
        });
        blocks = _.filter(blocks, (block) => { // Remove blocks with invalid occlusion
            let valid = false;
            try {
                let savedOcclusionHashMap = JSON.parse(Buffer.from(block.properties?.occlusion, 'base64').toString());
                // Iterate through all images
                for(let image in savedOcclusionHashMap) {
                    let occlusions = JSON.parse(Buffer.from(savedOcclusionHashMap[image], 'base64').toString());
                    let blockImages = block.content.match(MD_IMAGE_EMBEDED_REGEXP).map((image) => {
                        return image.replace(MD_IMAGE_EMBEDED_REGEXP, "$1");
                    });
                    if(occlusions && occlusions.length > 0 && blockImages.includes(image)) {
                        valid = true;
                        break;
                    }
                }
            }
            catch (e) { return false; }
            return valid;
        });
        return blocks;
    }
}
