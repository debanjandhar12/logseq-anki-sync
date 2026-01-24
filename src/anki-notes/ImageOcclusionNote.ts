import {Note} from "./Note";
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
    MD_PROPERTIES_REGEXP,
    ORG_PROPERTIES_REGEXP,
} from "../constants";
import {LogseqProxy} from "../logseq/LogseqProxy";
import {LogseqToHtmlConverterProxy, HTMLFile} from "../logseq/LogseqToHtmlConverter";
import {LogseqContentPreprocessor} from "../logseq/LogseqContentPreprocessor";
import {
    OcclusionData,
    showOcclusionEditor,
    OcclusionElement,
} from "../ui/pages/OcclusionEditor";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";
import {BlockEntity, BlockUUID} from "@logseq/libs/dist/LSPlugin";
import {showSelectionModal} from "../ui";

export type ImageToOcclusionDataHashMap = {[key: string]: OcclusionData};

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
        LogseqProxy.Editor.registerProperty("occlusion", {type: "default", cardinality: "one", hide: false});
    };

    public static async handleImageOcclusionOperation(block: BlockEntity | {uuid: string;}) {
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
                JSON.parse(
                    Buffer.from(
                        fetchedBlock.properties?.occlusion ||
                        Buffer.from("{}", "utf8").toString("base64"),
                        "base64",
                    ).toString(),
                ),
            );
        console.log(imgToOcclusionDataHashMap);
        imgToOcclusionDataHashMap = ImageOcclusionNote.migratePdfImages(
            imgToOcclusionDataHashMap,
            block_images,
        );
        console.log(imgToOcclusionDataHashMap);
        let selectedImage = null;
        let selectedImageIdx =
            block_images.length == 1
                ? 0
                : await showSelectionModal(
                    block_images.map((image) => {
                        return {
                            name: image,
                            icon: `<img class="px-4" height="48" width="64" src="${
                                image.match(isWebURL_REGEXP)
                                    ? image
                                    : WindowParentBridge.makeAssetUrl(image)
                            }"></img>`,
                        };
                    }),
                    {message: "Select Image for occlusion", enableKeySelect: true}
                );
        if (selectedImageIdx != null) selectedImage = block_images[selectedImageIdx];
        if (selectedImage) {
            selectedImage = (selectedImage as string).split("?")[0];
            const newOcclusionData = await showOcclusionEditor(
                selectedImage,
                _.get(
                    imgToOcclusionDataHashMap[selectedImage],
                    "elements",
                    [],
                ) as OcclusionElement[],
                {},
            );
            if (newOcclusionData && typeof newOcclusionData == "object") {
                imgToOcclusionDataHashMap[selectedImage] = newOcclusionData;
                if (
                    Buffer.from(JSON.stringify(imgToOcclusionDataHashMap), "utf8").toString(
                        "base64",
                    ) != fetchedBlock.properties?.occlusion
                ) {
                    console.log(imgToOcclusionDataHashMap, Buffer.from(JSON.stringify(imgToOcclusionDataHashMap), "utf8").toString(
                        "base64",
                    ));
                    await LogseqProxy.Editor.upsertBlockProperty(
                        getUUIDFromBlock(fetchedBlock),
                        "occlusion",
                        Buffer.from(JSON.stringify(imgToOcclusionDataHashMap), "utf8").toString(
                            "base64",
                        ),
                    );
                }
            }
        }
    }

    public async getClozedContentHTML(): Promise<HTMLFile> {
        let clozedContent: string = this.content;
        let imgToOcclusionDataHashMap = ImageOcclusionNote.upgradeProperties(
            JSON.parse(Buffer.from(this.properties?.occlusion, "base64").toString()),
        );
        const block = await LogseqProxy.Editor.getBlock(this.uuid);
        let block_images = await ImageOcclusionNote.getImagesInBlockOrNote(block);
        imgToOcclusionDataHashMap = ImageOcclusionNote.migratePdfImages(
            imgToOcclusionDataHashMap,
            block_images,
        );
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
        return LogseqToHtmlConverterProxy.convertToHTMLFile(clozedContent, this.format);
    }

    public static async getNotesFromLogseqBlocks(): Promise<ImageOcclusionNote[]> {
        type DatascriptQueryResult = [] | [{uuid: BlockUUID; page: { id: number }}][];
        let blocks : DatascriptQueryResult = [];
        if (!await LogseqProxy.App.checkCurrentIsDbGraph()) {
            blocks = await LogseqProxy.DB.datascriptQuery(`
                [:find (pull ?b [:block/uuid :block/page])
                :where
                  [?b :block/properties ?p]
                  [(get ?p :occlusion)]
                ]`, {suppressErrors: false});
        }
        else {
            blocks = await LogseqProxy.DB.datascriptQuery(`
                [:find (pull ?b [:block/uuid :block/page])
                :where
                  [?prop-e :block/tags :logseq.class/Property]
                  [?prop-e :db/ident ?prop]
                  [(name ?prop) ?prop-name]
                  [(clojure.string/ends-with? ?prop-name "occlusion")]
                  [?b ?prop _]
                ]`, {suppressErrors: false});
        }
        let notes: (ImageOcclusionNote | false)[] = await Promise.all(
            (blocks || []).map(async (b) => {
                const uuid = getUUIDFromBlock(b[0]);
                const pageId = _.get(b[0], 'page.id');
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
        console.log("ImageOcclusionNote Loaded", notes);
        notes = await Note.removeUnwantedNotes(notes as ImageOcclusionNote[]);
        notes = await Promise.all(
            _.map(notes, async (note: ImageOcclusionNote) => {
                // Remove blocks that do not have images with occlusion
                try {
                    let imgToOcclusionDataHashMap = ImageOcclusionNote.upgradeProperties(
                        JSON.parse(
                            Buffer.from(note.properties?.occlusion, "base64").toString(),
                        ),
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
            block.format || "markdown"
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
                    let block_ref_content = _.get(block_ref, "content");
                    const block_ref_props = _.get(block_ref, "properties");
                    block_ref_content = safeReplace(
                        block_ref_content,
                        MD_PROPERTIES_REGEXP,
                        "",
                    );
                    block_ref_content = safeReplace(
                        block_ref_content,
                        ORG_PROPERTIES_REGEXP,
                        "",
                    );
                    let block_ref_content_first_line =
                        getFirstNonEmptyLine(block_ref_content).trim();
                    const block_ref_props_str = block_ref_props
                        ? Object.keys(block_ref_props)
                              .map((key) => {
                                  return `${key}::${block_ref_props[key]}`;
                              })
                              .join("\n")
                        : "";
                    block_ref_content_first_line =
                        block_ref_props_str + "\n" + block_ref_content_first_line;
                    // Preprocess to extract PDF properties and normalize format
                    const refPreprocessResult = await LogseqContentPreprocessor.preprocess(
                        block_ref_content_first_line,
                        block_ref?.format || "markdown"
                    );
                    return refPreprocessResult.content;
                } catch (e) {
                    console.warn(e);
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
                    if (key == image && imgToOcclusionDataHashMap[image]) {
                        return true;
                    }
                    let imageURLParams: any = new Map();
                    try {
                        imageURLParams = new URLSearchParams(image.split("?")[1]);
                    } catch (e) {}
                    console.log(image, imageURLParams.get("imageAnnotationBlockUUID"));
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
        console.log(
            "migratePdfImages",
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
                };
            } else if (typeof value == "object" && value !== null && "elements" in value && Array.isArray((value as any).elements)) {
                // New format.
                newHashMap[key] = value as OcclusionData;
            }
        }
        return newHashMap;
    }
}
