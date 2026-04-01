import { Note } from "./Note";
import "@logseq/libs";
import { WindowParentBridge } from "../logseq/WindowParentBridge";
import { LogseqPropertiesHelper } from "../logseq/LogseqPropertiesHelper";
import {
    escapeClozesAndMacroDelimiters,
    getFirstNonEmptyLine,
    safeReplace,
    safeReplaceAsync,
} from "../utils/utils";
import _ from "lodash";
import {
    isImage_REGEXP,
    isWebURL_REGEXP,
    LOGSEQ_BLOCK_REF_REGEXP,
    MD_IMAGE_EMBEDED_REGEXP,
} from "../constants";
import { LogseqProxy } from "../logseq/LogseqProxy";
import { LogseqToHtmlConverterProxy, HTMLFile } from "../logseq/LogseqToHtmlConverter";
import { LogseqContentPreprocessor } from "../logseq/LogseqContentPreprocessor";
import {
    OcclusionData,
    OcclusionConfig,
    OcclusionElement,
} from "../ui/launchers/showOcclusionEditor";
import { showOcclusionEditor } from "../ui/launchers/showOcclusionEditor";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";
import { BlockEntity, BlockUUID } from "@logseq/libs/dist/LSPlugin";
import { showSelectionModal } from "../ui";

import { createLogger, LoggerCategory } from "../logger";
import { appendExtraToHtmlFile } from "./NoteUtils";
import { LogseqAppInfoFetcher } from "../logseq/LogseqAppInfoFetcher";
import { ObjectPropertyDataManager } from "../utils/ObjectPropertyDataManager";

const logger = createLogger(LoggerCategory.AnkiNotes);

export type ImageToOcclusionDataHashMap = { [key: string]: OcclusionData };

export class ImageOcclusionNote extends Note {
    public type = "image_occlusion";

    public constructor(
        uuid: string,
        content: string,
        format: string,
        properties: any,
        pageId: number,
        tags: string[] = [],
    ) {
        super(uuid, content, format, properties, pageId, tags);
    }

    public static initLogseqOperations = () => {
        logseq.Editor.registerBlockContextMenuItem("Image Occlusion", async (block) => {
            await ImageOcclusionNote.handleImageOcclusionOperation(block);
        });
        logseq.Editor.registerSlashCommand("Image Occlusion", async (block) => {
            await ImageOcclusionNote.handleImageOcclusionOperation(block);
        });
        LogseqProxy.Editor.registerProperty("occlusion", {
            type: "default",
            cardinality: "one",
            hide: false,
        });
    };

    public static async handleImageOcclusionOperation(block: BlockEntity | { uuid: string }) {
        if (!LogseqAppInfoFetcher.checkHostAccess()) {
            await logseq.UI.showMsg(
                "Opening Occlusion Editor is not supported in Logseq Web since plugin cannot read image files at the moment.",
                "error",
            );
            return;
        }
        const uuid = getUUIDFromBlock(block as BlockEntity);
        // Dont use LogseqProxy.Editor.getBlock() here. It will cause a bug due to activeCache.
        // Use helper method to get fresh block with properties
        const fetchedBlock = await LogseqPropertiesHelper.getBlock(uuid);
        if (!fetchedBlock) {
            await logseq.UI.showMsg("Block not found.", "error");
            return;
        }
        const block_images = await ImageOcclusionNote.getImagesInBlockOrNote(fetchedBlock);
        if (block_images.length == 0) {
            await logseq.UI.showMsg("No images found in this block.", "warning");
            return;
        }
        let imgToOcclusionDataHashMap: ImageToOcclusionDataHashMap =
            ImageOcclusionNote.upgradeProperties(
                ObjectPropertyDataManager.load(fetchedBlock, "occlusion") || {},
            );
        logger.info(imgToOcclusionDataHashMap);
        imgToOcclusionDataHashMap = ImageOcclusionNote.migratePdfImages(
            imgToOcclusionDataHashMap,
            block_images,
        );
        logger.info(imgToOcclusionDataHashMap);
        let selectedImage = null;
        let selectedImageIdx =
            block_images.length == 1
                ? 0
                : await showSelectionModal(
                    await Promise.all(
                        block_images.map(async (image) => {
                            return {
                                name: image,
                                icon: `<img class="px-4" height="48" width="64" src="${image.match(isWebURL_REGEXP)
                                        ? image
                                        : await WindowParentBridge.makeAssetUrl(image)
                                    }"></img>`,
                            };
                        }),
                    ),
                    { message: "Select Image for occlusion", enableKeySelect: true },
                );
        if (selectedImageIdx != null) selectedImage = block_images[selectedImageIdx];
        if (selectedImage) {
            selectedImage = (selectedImage as string).split("?")[0];
            const blockTags = _.get(fetchedBlock, "properties.tags", []) as string[];
            const newOcclusionData = await showOcclusionEditor(
                selectedImage,
                _.get(
                    imgToOcclusionDataHashMap[selectedImage],
                    "elements",
                    [],
                ) as OcclusionElement[],
                _.get(
                    imgToOcclusionDataHashMap[selectedImage],
                    "config",
                    {},
                ) as OcclusionConfig,
                blockTags,
            );
            if (newOcclusionData && typeof newOcclusionData == "object") {
                imgToOcclusionDataHashMap[selectedImage] = newOcclusionData;
                await ObjectPropertyDataManager.save(fetchedBlock, "occlusion", imgToOcclusionDataHashMap);

                // Handle tag updates for hide-all-test-one
                const blockUUID = getUUIDFromBlock(fetchedBlock);
                const tag = await logseq.Editor.getTag("hide-all-test-one");
                if (tag) {
                    if (newOcclusionData.tags.includes("hide-all-test-one")) {
                        await logseq.Editor.addBlockTag(blockUUID, tag.uuid);
                    } else {
                        await logseq.Editor.removeBlockTag(blockUUID, tag.uuid);
                    }
                }
            }
        }
    }

    public async getClozedContentHTML(): Promise<HTMLFile> {
        let clozedContent: string = this.content;
        let imgToOcclusionDataHashMap = ImageOcclusionNote.upgradeProperties(
            ObjectPropertyDataManager.load(this, "occlusion") || {},
        );
        const block = await LogseqProxy.Editor.getBlock(this.uuid);
        let block_images = await ImageOcclusionNote.getImagesInBlockOrNote(block);
        imgToOcclusionDataHashMap = ImageOcclusionNote.migratePdfImages(
            imgToOcclusionDataHashMap,
            block_images,
        );

        // Check for hide-all-test-one tag on the block
        const hasHideAllTestOneTag = this.tags.includes("hide-all-test-one");

        const clozes = new Set();
        for (const image in imgToOcclusionDataHashMap) {
            const occlusionElements = imgToOcclusionDataHashMap[image].elements;
            block_images = block_images.map((image) => image.split("?")[0]);
            if (block_images.includes(image)) {
                for (const occlusion of occlusionElements) {
                    clozes.add(occlusion.cId);
                }
            }
        }
        clozedContent = escapeClozesAndMacroDelimiters(clozedContent);
        clozedContent += `\n<div class="hidden">
        ${Array.from(clozes)
                .map((cloze) => `{{c${cloze}:: ::<span id="c${cloze}"></span>}}`)
                .join("")}
        <div id="imgToOcclusionDataHashMap">${JSON.stringify(imgToOcclusionDataHashMap)}</div>
        <img id="localImgBasePath" src="_logseq_anki_sync.css"></img>
        </div>`;

        const result = await LogseqToHtmlConverterProxy.convertToHTMLFile(
            clozedContent,
            this.format,
        );

        // --- Add extra property content (non-indented) ---
        return appendExtraToHtmlFile(
            result,
            _.get(await LogseqProxy.Editor.getBlock(this.uuid), "properties.extra") as string,
            this.format,
            true,
        );
    }

    public static async getNotesFromLogseqBlocks(): Promise<ImageOcclusionNote[]> {
        type DatascriptQueryResult = [] | [{ uuid: BlockUUID; page: { id: number } }][];
        let blocks: DatascriptQueryResult = [];
        if (!(await LogseqProxy.App.checkCurrentIsDbGraph())) {
            blocks = await LogseqProxy.DB.datascriptQuery(
                `
                [:find (pull ?b [:block/uuid :block/page])
                :where
                  [?b :block/properties ?p]
                  [(get ?p :occlusion)]
                ]`,
                { suppressErrors: false },
            );
        } else {
            blocks = await LogseqProxy.DB.datascriptQuery(
                `
                [:find (pull ?b [:block/uuid :block/page])
                :where
                  [?prop-e :block/tags :logseq.class/Property]
                  [?prop-e :db/ident ?prop]
                  [(name ?prop) ?prop-name]
                  [(clojure.string/ends-with? ?prop-name "occlusion")]
                  [?b ?prop _]
                ]`,
                { suppressErrors: false },
            );
        }
        let notes: (ImageOcclusionNote | false)[] = await Promise.all(
            (blocks || []).map(async (b) => {
                const uuid = getUUIDFromBlock(b[0]);
                const pageId = _.get(b[0], "page.id");
                if (!pageId) return null;

                let block = await LogseqProxy.Editor.getBlock(uuid);
                if (block)
                    return new ImageOcclusionNote(
                        uuid,
                        block.content,
                        block.format,
                        block.properties || {},
                        pageId,
                        _.get(block, "properties.tags", []) as string[],
                    );
                else {
                    return null;
                }
            }),
        );
        logger.info("ImageOcclusionNote Loaded", notes);
        notes = await Note.removeUnwantedNotes(notes as ImageOcclusionNote[]);
        notes = await Promise.all(
            _.map(notes, async (note: ImageOcclusionNote) => {
                // Remove blocks that do not have images with occlusion
                try {
                    let imgToOcclusionDataHashMap = ImageOcclusionNote.upgradeProperties(
                        ObjectPropertyDataManager.load(note, "occlusion") || {},
                    );
                    let blockImages = await ImageOcclusionNote.getImagesInBlockOrNote(note);
                    imgToOcclusionDataHashMap = ImageOcclusionNote.migratePdfImages(
                        imgToOcclusionDataHashMap,
                        blockImages,
                    );
                    blockImages = blockImages.map((image) => image.split("?")[0]);
                    for (const image in imgToOcclusionDataHashMap) {
                        const occlusionElements = imgToOcclusionDataHashMap[image].elements;
                        if (
                            occlusionElements &&
                            occlusionElements.length > 0 &&
                            blockImages.includes(image)
                        )
                            return note; // Found a valid occlusion!
                    }
                } catch (e) {
                    return false;
                } // Most likely, the occlusion property is not a valid JSON string. Return false.
                return false; // No valid occlusion found. Return false.
            }),
        );
        notes = _.without(notes, false);
        return notes as ImageOcclusionNote[];
    }

    // -- Helper functions --
    public static async getImagesInBlockOrNote(block: any): Promise<string[]> {
        let block_content = block.content;
        // Preprocess to extract PDF properties and normalize format
        const preprocessResult = await LogseqContentPreprocessor.preprocess(
            block_content,
            block.format || "markdown",
        );
        block_content = preprocessResult.content;

        block_content = await safeReplaceAsync(
            block_content,
            LOGSEQ_BLOCK_REF_REGEXP,
            async (match, blockUUID) => {
                // Add contents of direct block refs (1-level)
                try {
                    // Dont use LogseqProxy.Editor.getBlock() here. It will cause a bug due to activeCache.
                    // Use helper method to get fresh block with properties
                    const block_ref = await LogseqPropertiesHelper.getBlock(blockUUID);
                    let preprocessResult = await LogseqContentPreprocessor.preprocess(
                        block_ref?.content || "",
                        block_ref?.format || "markdown",
                    );
                    let block_content = preprocessResult.content;
                    let block_props = preprocessResult.properties || {};
                    let block_content_first_line = getFirstNonEmptyLine(block_content).trim();
                    block_content_first_line =
                        escapeClozesAndMacroDelimiters(block_content_first_line);

                    let blockRef_content = block_content_first_line;
                    for (const [prop, value] of Object.entries(block_props))
                        blockRef_content += `\n${prop}:: ${value}`;

                    return getFirstNonEmptyLine(blockRef_content);
                } catch (e) {
                    logger.warn(e);
                }
                return match;
            },
        );
        let block_images = (block_content.match(MD_IMAGE_EMBEDED_REGEXP) || []).map(
            (block_image) => {
                block_image = block_image.replace(MD_IMAGE_EMBEDED_REGEXP, "$1");
                if (!block_image.split("?")[0].match(isImage_REGEXP)) return ""; // Ignore non-images
                return block_image;
            },
        );
        block_images = _.uniq(block_images);
        block_images = _.filter(block_images, (image) => image.trim() != "");
        return block_images;
    }

    // This migrates the occlusions associated with older image annotation links with newer ones
    private static migratePdfImages(
        imgToOcclusionDataHashMap: ImageToOcclusionDataHashMap,
        block_images: string[],
    ): ImageToOcclusionDataHashMap {
        const newImgToOcclusionDataHashMap = {};
        block_images.forEach((image) => {
            const k = Object.keys(imgToOcclusionDataHashMap)
                .sort()
                .reverse()
                .find((key) => {
                    if (image.startsWith(key) && imgToOcclusionDataHashMap[key]) {
                        return true;
                    }
                    let imageURLParams: any = new Map();
                    try {
                        imageURLParams = new URLSearchParams(image.split("?")[1]);
                    } catch (e) { }
                    logger.info(image, imageURLParams.get("imageAnnotationBlockUUID"));
                    if (
                        imageURLParams.get("imageAnnotationBlockUUID") &&
                        key.includes(imageURLParams.get("imageAnnotationBlockUUID"))
                    ) {
                        return true;
                    }
                    return false;
                });
            if (k) {
                newImgToOcclusionDataHashMap[image.split("?")[0]] =
                    imgToOcclusionDataHashMap[k];
            }
        });
        logger.info(
            "migratePdfImages",
            block_images,
            imgToOcclusionDataHashMap,
            newImgToOcclusionDataHashMap,
        );
        return newImgToOcclusionDataHashMap;
    }

    private static upgradeProperties(hashMap: any): ImageToOcclusionDataHashMap {
        const newHashMap: ImageToOcclusionDataHashMap = {};
        for (const [key, value] of Object.entries(hashMap)) {
            if (Array.isArray(value)) {
                // Old format (< 5.6.0 of logseq-anki-sync). Upgrade it.
                newHashMap[key] = {
                    elements: value,
                    config: {},
                    tags: [],
                };
            } else if (
                typeof value == "object" &&
                value !== null &&
                "elements" in value &&
                Array.isArray((value as any).elements)
            ) {
                // New format - ensure tags property exists
                const occlusionData = value as OcclusionData;
                if (!occlusionData.tags) {
                    occlusionData.tags = [];
                }
                newHashMap[key] = occlusionData;
            }
        }
        return newHashMap;
    }
}
