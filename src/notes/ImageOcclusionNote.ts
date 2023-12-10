import {Note} from "./Note";
import "@logseq/libs";
import {
    escapeClozeAndSecoundBrace,
    getFirstNonEmptyLine,
    getRandomUnicodeString,
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
import {convertToHTMLFile, HTMLFile, processProperties} from "../converter/Converter";
import {
    OcclusionData,
    OcclusionEditor,
    OcclusionElement,
} from "../ui/customized/OcclusionEditor";
import getUUIDFromBlock from "../logseq/getUUIDFromBlock";
import {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {SelectionModal} from "../ui/general/SelectionModal";
import {val} from "cheerio/lib/api/attributes";

export type ImageToOcclusionDataHashMap = {[key: string]: OcclusionData};

export class ImageOcclusionNote extends Note {
    public type = "image_occlusion";

    public constructor(
        uuid: string,
        content: string,
        format: string,
        properties: any,
        page: any,
        tagIds: number[] = [],
    ) {
        super(uuid, content, format, properties, page, tagIds);
    }

    public static initLogseqOperations = () => {
        logseq.Editor.registerBlockContextMenuItem("Image Occlusion", async (block) => {
            const uuid = getUUIDFromBlock(block as BlockEntity);
            block = await logseq.Editor.getBlock(uuid); // Dont use LogseqProxy.Editor.getBlock() here. It will cause a bug due to activeCache.
            const block_images = await ImageOcclusionNote.getImagesInBlockOrNote(block);
            if (block_images.length == 0) {
                await logseq.UI.showMsg("No images found in this block.", "warning");
                return;
            }
            let imgToOcclusionDataHashMap: ImageToOcclusionDataHashMap =
                ImageOcclusionNote.upgradeProperties(
                    JSON.parse(
                        Buffer.from(
                            block.properties?.occlusion ||
                                Buffer.from("{}", "utf8").toString("base64"),
                            "base64",
                        ).toString(),
                    ),
                );
            imgToOcclusionDataHashMap = ImageOcclusionNote.migratePdfImages(
                imgToOcclusionDataHashMap,
                block_images,
            );
            let selectedImage = null;
            let selectedImageIdx =
                block_images.length == 1
                    ? 0
                    : await SelectionModal(
                          block_images.map((image) => {
                              return {
                                  name: image,
                                  icon: `<img class="px-4" height="48" width="64" src="${
                                      image.match(isWebURL_REGEXP)
                                          ? image
                                          : window.parent.logseq.api.make_asset_url(image)
                                  }"></img>`,
                              };
                          }),
                          "Select Image for occlusion",
                          true,
                      );
            if (selectedImageIdx != null) selectedImage = block_images[selectedImageIdx];
            if (selectedImage) {
                selectedImage = (selectedImage as string).split("?")[0];
                const newOcclusionData = await OcclusionEditor(
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
                        ) == block.properties?.occlusion
                    )
                        console.log("No change");
                    await LogseqProxy.Editor.upsertBlockProperty(
                        uuid,
                        "occlusion",
                        Buffer.from(JSON.stringify(imgToOcclusionDataHashMap), "utf8").toString(
                            "base64",
                        ),
                    );
                }
            }
        });
    };

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
        clozedContent += `\n<div class="hidden">
        ${Array.from(clozes)
            .map((cloze) => `{{c${cloze}:: ::<span id="c${cloze}"></span>}}`)
            .join("")}
        <div id="imgToOcclusionDataHashMap">${JSON.stringify(imgToOcclusionDataHashMap)}</div>
        <img id="localImgBasePath" src="_logseq_anki_sync.css"></img>
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
        let notes: (ImageOcclusionNote | false)[] = await Promise.all(
            blocks.map(async (block) => {
                const uuid = getUUIDFromBlock(block[0]);
                const page = block[0].page
                    ? await LogseqProxy.Editor.getPage(block[0].page.id)
                    : {};
                block = block[0];
                if (!block.content) {
                    block = await LogseqProxy.Editor.getBlock(uuid);
                }
                if (block)
                    return new ImageOcclusionNote(
                        uuid,
                        block.content,
                        block.format,
                        block.properties || {},
                        page,
                        _.get(block, "refs", []).map((ref) => ref.id),
                    );
                else {
                    return null;
                }
            }),
        );
        console.log("ImageOcclusionNote Loaded", notes);
        notes = await Note.removeUnwantedNotes(notes as ImageOcclusionNote[]);
        notes = await Promise.all(
            _.map(notes, async (note) => {
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
        block_content = await processProperties(block_content); // Process pdf properties
        block_content = await safeReplaceAsync(
            block_content,
            LOGSEQ_BLOCK_REF_REGEXP,
            async (match, blockUUID) => {
                // Add contents of direct block refs (1-level)
                try {
                    const block_ref = await logseq.Editor.getBlock(blockUUID); // Dont use LogseqProxy.Editor.getBlock() here. It will cause a bug due to activeCache.
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
                    block_ref_content_first_line = await processProperties(
                        block_ref_content_first_line,
                    ); // Process pdf properties
                    return block_ref_content_first_line;
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
                    if (imgToOcclusionDataHashMap[image]) {
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
            } else if (typeof value == "object" && Array.isArray(value.elements)) {
                // New format.
                newHashMap[key] = value as OcclusionData;
            }
        }
        return newHashMap;
    }
}
