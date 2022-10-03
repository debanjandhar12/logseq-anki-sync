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
        return { html: clozedContent, assets: new Set() };
    }

    public static async getNotesFromLogseqBlocks(): Promise<ImageOcclusionNote[]> {
        return [];
    }
}
