import React, {useState, useEffect, useCallback, useRef} from "../React";
import _ from "lodash";
import { fabric } from "fabric";
import path from "path-browserify";
import {
    ADD_OCCLUSION_ICON,
    ANKI_ICON,
    DONATE_ICON,
    isWebURL_REGEXP,
    REMOVE_OCCLUSION_ICON,
    SETTINGS_ICON,
} from "../../constants";
import {Modal, useModal, createModalPromise, ModalHeader, DialogModalFooter} from "../";
import {LogseqButton} from "../common/LogseqButton";
import {LogseqCheckbox} from "../common/LogseqCheckbox";
import {createWorker, PSM} from "tesseract.js";
import { UI } from "../UI";
import { createOcclusionRectEl } from "../../utils/occlusionUtils";
import { WindowBridge } from "../../logseq/WindowBridge";

import { createLogger, LoggerCategory } from "../../utils/logger";
import {WindowParentBridge} from "../../logseq/WindowParentBridge";

const logger = createLogger(LoggerCategory.Others);

export type OcclusionElement = {
    left: number;
    top: number;
    width: number;
    height: number;
    angle: number;
    cId: number;
};

export type OcclusionConfig = {
    // hideAllTestOne is now controlled via #hide-all-test-one tag
    // This type is kept for possible future user-defined config options
};

export type OcclusionData = {
    config: OcclusionConfig;
    elements: Array<OcclusionElement>;
    tags: string[];
};

export async function showOcclusionEditor(
    imgURL: string,
    occlusionElements: Array<OcclusionElement>,
    occlusionConfig: OcclusionConfig,
    blockTags: string[] = [],
): Promise<OcclusionData | boolean> {
    return createModalPromise<OcclusionData | boolean>(
        (props) => (
            <OcclusionEditorComponent
                imgURL={imgURL}
                occlusionElements={occlusionElements}
                occlusionConfig={occlusionConfig}
                blockTags={blockTags}
                {...props}
            />
        ),
        {},
        { errorMessage: "Failed to open Occlusion Editor" }
    );
}

const OcclusionEditorComponent: React.FC<{
    imgURL: string;
    occlusionElements: Array<OcclusionElement>;
    occlusionConfig: OcclusionConfig;
    blockTags: string[];
    resolve: (value: OcclusionData | boolean) => void;
    reject: Function;
    modalContext?: { modalId: string | null };
}> = ({imgURL, occlusionElements, occlusionConfig, blockTags, resolve, reject, modalContext}) => {
    const { open, setOpen, returnResult } = useModal<OcclusionData | boolean>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: false, // We'll handle Escape key manually due to complex interactions
        enableEnterKey: false,   // We'll handle Enter key manually
        modalId: modalContext?.modalId,
    });
    const [tags, setTags] = React.useState<string[]>(blockTags);
    const fabricRef = React.useRef<any>();
    const canvasRef = React.useRef(null);
    const cidSelectorRef = React.useRef(null);
    const [imgEl, setImgEl] = React.useState(WindowBridge.createElement('img'));
    const handleConfirm = () => {
        const newOcclusionElements = fabricRef.current.getObjects().map((obj) => {
            // https://github.com/fabricjs/fabric.js/issues/801#issuecomment-218116910
            const matrix = obj.calcTransformMatrix();
            const actualTop = matrix[5];
            const actualLeft = matrix[4];

            return {
                left: actualLeft,
                top: actualTop,
                width: obj.getScaledWidth(),
                height: obj.getScaledHeight(),
                angle: obj.angle,
                cId: parseInt(obj._objects[1].text),
            };
        });

        returnResult({
            config: occlusionConfig,
            elements: newOcclusionElements,
            tags: tags,
        });
    };
    
    const handleCancel = () => {
        returnResult(false);
    };

    React.useEffect(() => {
        let isMounted = true;

        const initFabric = async () => {
            fabricRef.current = new fabric.Canvas(canvasRef.current, {
                stateful: true,
            });
            fabricRef.current.selection = false; // disable group selection
            fabricRef.current.uniformScaling = false; // disable object scaling keeping aspect ratio

            // Load the image and then add the occlusion rectangles
            imgEl.setAttribute("crossOrigin", "anonymous");
            const graphPath = (await logseq.App.getCurrentGraph()).path;

            // Use Logseq's asset API for local files to avoid CORS issues
            if (isWebURL_REGEXP.test(imgURL)) {
                imgEl.src = imgURL;
            } else {
                const fullPath = path.join(graphPath, path.resolve(imgURL));
                // Use Logseq's asset API to get a proper URL
                imgEl.src = await WindowParentBridge.makeAssetUrl(fullPath);
            }

            imgEl.onload = function () {
                // Check if component is still mounted before proceeding
                if (!isMounted || !fabricRef.current) {
                    return;
                }

                const img = new fabric.Image(imgEl);
                const appRoot = WindowBridge.getElementById('app');
                const canvasWidth = Math.min(
                    imgEl.width,
                    appRoot?.clientWidth - 160 || 800,
                );
                const canvasHeight = Math.min(
                    imgEl.height,
                    WindowBridge.getBody().clientHeight - 340,
                );
                const scale = Number(
                    Math.min(
                        canvasWidth / imgEl.width,
                        canvasHeight / imgEl.height,
                    ).toPrecision(1),
                );
                fabricRef.current.setZoom(scale);
                fabricRef.current.setWidth(imgEl.width * scale);
                fabricRef.current.setHeight(imgEl.height * scale);
                fabricRef.current.setBackgroundImage(
                    img,
                    fabricRef.current.renderAll.bind(fabricRef.current),
                    {
                        scaleX: 1,
                        scaleY: 1,
                    },
                );
                fabricRef.current.selection = true;
                fabricRef.current.renderAll();

                occlusionElements.forEach((obj) => {
                    const occlusionEl = createOcclusionRectEl(
                        fabric,
                        obj.left,
                        obj.top,
                        obj.width,
                        obj.height,
                        obj.angle,
                        obj.cId,
                    );
                    fabricRef.current.add(occlusionEl);
                });
                fabricRef.current.renderAll();
            };
        };

        const disposeFabric = () => {
            isMounted = false;
            // Clear the image onload handler to prevent it from firing after disposal
            imgEl.onload = null;
            if (fabricRef.current) {
                fabricRef.current.dispose();
                fabricRef.current = null;
            }
        };

        initFabric();

        return () => {
            disposeFabric();
        };
    }, [open]);

    // Handle Selection
    const [fabricSelection, setFabricSelection] = React.useState<Array<any>>([]);
    React.useEffect(() => {
        if (!fabricRef || !fabricRef.current) return;
        fabricRef.current.on("selection:created", function () {
            setFabricSelection(fabricRef.current.getActiveObjects());
        });
        fabricRef.current.on("selection:updated", function () {
            setFabricSelection(fabricRef.current.getActiveObjects());
        });
        fabricRef.current.on("selection:cleared", function () {
            setFabricSelection(null);
        });
    }, [fabricRef]);
    React.useEffect(() => {
        if (fabricSelection && fabricSelection.length > 0) {
            cidSelectorRef.current.value = fabricSelection[0]._objects[1].text;
        }
    }, [fabricSelection]);

    // Show zoom view on mouse hover
    const [zoomView, setZoomView] = React.useState<string>(null);
    React.useEffect(() => {
        if (!fabricRef || !fabricRef.current) return;
        fabricRef.current.on("mouse:move", function (e: any) {
            setZoomView(() => {
                const currentZoom = fabricRef.current.getZoom();
                if (currentZoom >= 1) return null;
                fabricRef.current.setZoom(1.5);
                const zoomImg = fabricRef.current.toDataURL({
                    top: e.e.offsetY * (1.5 / currentZoom) - 15,
                    left: e.e.offsetX * (1.5 / currentZoom) - 30,
                    width: 60,
                    height: 30,
                });
                fabricRef.current.setZoom(currentZoom);
                return zoomImg;
            });
        });
        fabricRef.current.on("mouse:out", function (e: any) {
            setZoomView(null);
        });
    }, [fabricRef]);

    // Prevent out of bounds - https://stackoverflow.com/a/42915768
    React.useEffect(() => {
        if (!fabricRef || !fabricRef.current) return;
        const preventOutOfBounds = (e: any) => {
            if (e.target.originX != "center") {
                e.target.left = Math.min(
                    Math.max(e.target.left, 0),
                    imgEl.width - e.target.width * e.target.scaleX,
                );
                e.target.top = Math.min(
                    Math.max(e.target.top, 0),
                    imgEl.height - e.target.height * e.target.scaleY,
                );
            } else {
                const top = e.target.top;
                const left = e.target.left;
                const bottom = e.target.top + e.target.height * e.target.scaleY;
                const right = e.target.left + e.target.width * e.target.scaleX;
                const halfObjectHeight = (bottom - top) / 2;
                const halfObjectWidth = (right - left) / 2;
                const topBound = halfObjectHeight;
                const bottomBound = imgEl.height - halfObjectHeight;
                const leftBound = halfObjectWidth;
                const rightBound = imgEl.width - halfObjectWidth;
                e.target.left = Math.min(Math.max(left, leftBound), rightBound);
                e.target.top = Math.min(Math.max(top, topBound), bottomBound);
            }
        };

        fabricRef.current.on("selection:created", (e) => {
            if (fabricRef.current.getActiveObjects().length > 1) {
                fabric.Group.prototype.lockScalingX = true;
                fabric.Group.prototype.lockScalingY = true;
                fabric.Group.prototype.lockRotation = true;
                fabricRef.current.renderAll();
            } else {
                fabric.Group.prototype.lockScalingX = false;
                fabric.Group.prototype.lockScalingY = false;
                fabric.Group.prototype.lockRotation = false;
                fabricRef.current.renderAll();
            }
        });
        fabricRef.current.on("object:moving", preventOutOfBounds);
        fabricRef.current.on("object:modified", preventOutOfBounds);
    }, [fabricRef]);

    // Handle some key events
    React.useEffect(() => {
        if (!fabricRef || !open) return;
        const onKeydown = (e: KeyboardEvent) => {
            if (!fabricRef || !open) return;
            if (e.key === "Escape" && fabricRef.current.getActiveObjects().length > 0) {
                logger.info(fabricRef);
                fabricRef.current.discardActiveObject();
                fabricRef.current.renderAll();
                e.preventDefault();
                e.stopImmediatePropagation();
            } else if (e.key === "Escape") {
                handleCancel();
                e.preventDefault();
                e.stopImmediatePropagation();
            }
            if (e.ctrlKey && e.key === "a") {
                fabricRef.current.discardActiveObject();
                var sel = new fabric.ActiveSelection(
                    fabricRef.current.getObjects(),
                    {
                        canvas: fabricRef.current,
                    },
                );
                fabricRef.current.setActiveObject(sel);
                fabricRef.current.renderAll();
                e.preventDefault();
                e.stopImmediatePropagation();
            }
            if (e.key === "Enter") {
                handleConfirm();
                e.preventDefault();
                e.stopImmediatePropagation();
            }
            if (e.key === "Delete" && fabricRef.current.getActiveObjects().length > 0) {
                deleteOcclusion();
                e.preventDefault();
                e.stopImmediatePropagation();
            }
            if (e.key === "Insert") {
                addOcclusion();
                e.preventDefault();
                e.stopImmediatePropagation();
            }
            if (e.key === "ArrowUp") {
                if (fabricRef.current.getActiveObject()) {
                    fabricRef.current.getActiveObject().top -= 1;
                    fabricRef.current.renderAll();
                    fabricRef.current.fire("object:modified", {
                        target: fabricRef.current.getActiveObject(),
                    });
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }
            if (e.key === "ArrowDown") {
                if (fabricRef.current.getActiveObject()) {
                    fabricRef.current.getActiveObject().top += 1;
                    fabricRef.current.renderAll();
                    fabricRef.current.fire("object:modified", {
                        target: fabricRef.current.getActiveObject(),
                    });
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }
            if (e.key === "ArrowLeft") {
                if (fabricRef.current.getActiveObject()) {
                    fabricRef.current.getActiveObject().left -= 1;
                    fabricRef.current.renderAll();
                    fabricRef.current.fire("object:modified", {
                        target: fabricRef.current.getActiveObject(),
                    });
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }
            if (e.key === "ArrowRight") {
                if (fabricRef.current.getActiveObject()) {
                    fabricRef.current.getActiveObject().left += 1;
                    fabricRef.current.renderAll();
                    fabricRef.current.fire("object:modified", {
                        target: fabricRef.current.getActiveObject(),
                    });
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }
            if (e.key >= "1" && e.key <= "9") {
                if (fabricRef.current.getActiveObject()) {
                    cidSelectorRef.current.value = e.key;
                    const event = new Event("change", {bubbles: true});
                    cidSelectorRef.current.dispatchEvent(event);
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }
        };
        WindowBridge.addDocumentEventListener("keydown", onKeydown, {
            capture: true,
        });
        return () => {
            WindowBridge.removeDocumentEventListener("keydown", onKeydown, {capture: true});
        };
    }, [fabricRef, open]);

    // Create the UI
    const addOcclusion = () => {
        const randomLocation = {
            x:
                Math.floor(Math.random() * (imgEl.width - 0.22 * imgEl.width)) +
                0.11 * imgEl.width,
            y:
                Math.floor(Math.random() * (imgEl.height - 0.22 * imgEl.height)) +
                0.11 * imgEl.height,
        };
        const occlusionEl = createOcclusionRectEl(
            fabric,
            randomLocation.x,
            randomLocation.y,
            0.22 * imgEl.width,
            0.22 * imgEl.height,
        );
        fabricRef.current.add(occlusionEl);
        fabricRef.current.setActiveObject(occlusionEl);
        fabricRef.current.renderAll();
    };
    const deleteOcclusion = () => {
        fabricRef.current.remove(...fabricRef.current.getActiveObjects());
        fabricRef.current.renderAll();
    };
    const onCIdChange = () => {
        fabricSelection.forEach((obj) => {
            obj._objects[1].set("text", cidSelectorRef.current.value);
        });
        fabricRef.current.renderAll();
    };
    const [isAIGeneratingOcclusion, setIsAIGeneratingOcclusion] = useState(false);

    const aiGenerateOcclusion = async () => {
        let worker = null;
        try {
            setIsAIGeneratingOcclusion(true);
            worker = await createWorker("eng", 3, {
                langPath: 'https://tessdata.projectnaptha.com/4.0.0_best'
            });
            await worker.setParameters({tessedit_pageseg_mode: PSM.SPARSE_TEXT});
            const ret = await worker.recognize(imgEl.src);
            logger.info(ret);
            let counter = 0;
            if (!ret.data.confidence || ret.data.confidence < 40)
                throw new Error("AI failed to recognize the image");
            const avgParagraphTextLength = _.meanBy(
                _.get(ret, "data.paragraphs", []),
                (paragraph) => (paragraph as {text: string}).text.trim().length,
            );
            for (const paragraph of _.get(ret, "data.paragraphs", [])) {
                const width = paragraph.bbox.x1 - paragraph.bbox.x0;
                const height = paragraph.bbox.y1 - paragraph.bbox.y0;

                // Ignore low confidence paragraphs
                if (paragraph.confidence < 48) continue;
                // Ignore small occlusions
                if (width < 4 || height < 4) continue;
                if (width * height < Math.pow(0.025, 2) * imgEl.width * imgEl.height) continue;
                if (paragraph.text.trim().length < Math.min(avgParagraphTextLength / 2, 3)) continue;

                // Ignore occlusions that intersect with existing ones
                function doRectsCollide(a, b) {
                    return !(
                        a.top + a.height < b.top ||
                        a.top > b.top + b.height ||
                        a.left + a.width < b.left ||
                        a.left > b.left + b.width
                    );
                }
                let intersects = false;
                for (const obj of fabricRef.current.getObjects()) {
                    const matrix = obj.calcTransformMatrix();
                    const objActualTop = matrix[5];
                    const objActualLeft = matrix[4];
                    if (doRectsCollide(
                        {
                            top: paragraph.bbox.y0,
                            left: paragraph.bbox.x0,
                            width: width,
                            height: height,
                        },
                        {
                            top: objActualTop - (obj.height * obj.scaleY) / 2,
                            left: objActualLeft - (obj.width * obj.scaleX) / 2,
                            width: obj.width * obj.scaleX,
                            height: obj.height * obj.scaleY,
                        })) {
                        intersects = true;
                        break;
                    }
                }
                if (intersects) continue;

                const occlusionEl = createOcclusionRectEl(
                    fabric,
                    paragraph.bbox.x0 + width / 2,
                    paragraph.bbox.y0 + height / 2,
                    width,
                    height,
                    null,
                    (counter++ % 9) + 1,
                );
                fabricRef.current.add(occlusionEl);
                fabricRef.current.renderAll();
            }
            if (counter === 0)
                logseq.Editor.showMsg("All possible occlusions already present.", "warning");
            else logseq.Editor.showMsg(`Generated ${counter} occlusions`, "success");
        } catch (e) {
            logseq.Editor.showMsg("Failed to generate occlusions", "error");
        }
        if (worker) await worker.terminate();
        setIsAIGeneratingOcclusion(false);
    };

    return (
        <Modal
            open={open}
            setOpen={setOpen}
            onClose={() => UI.hideModal(modalContext?.modalId)}
            hasCloseButton={false}
            enableEscapeKey={false}
            size={"large"}>
            <div style={{margin: '0rem'}}>
                <ModalHeader
                    title="Occlusion Editor"
                    icon={ANKI_ICON}
                    onClose={() => setOpen(false)}
                    showCloseButton={true}
                >
                    <a href="https://github.com/sponsors/debanjandhar12">
                        <img alt="Donate" style={{height: "1.4rem"}} src={DONATE_ICON} />
                    </a>
                </ModalHeader>
                <div
                    style={{
                        borderBottom: "1px solid var(--ls-border-color)",
                        alignItems: "center",
                        justifyContent: "end",
                    }}
                    className="occlusion-editor-toolbar flex">
                    {zoomView && (
                        <span
                            className={"text-sm opacity-80"}
                            style={{
                                paddingLeft: "0.25rem",
                                display: 'flex',
                                alignItems: "center",
                                margin: "0.125rem auto 0.125rem 0",
                            }}>
                            <img src={zoomView} />
                            <span className={"sm:hidden md:block"}>&lt;- Zoom</span>
                        </span>
                    )}
                    <span
                        className={
                            fabricSelection && fabricSelection.length > 0 ? "flex" : "hidden"
                        }
                        style={{
                            alignItems: "center",
                            justifyItems: "center",
                            paddingRight: "0.5rem",
                            borderRight: "1px solid var(--ls-border-color)",
                        }}>
                        {/* Add additional toolbar for fabricselection here */}
                        <span style={{visibility: "hidden"}}>
                            <LogseqButton size={"sm"} icon={ADD_OCCLUSION_ICON} />
                        </span>{" "}
                        {/* An hack to align with the other buttons */}
                        <div style={{position: "relative", width: "80px", height: "1.6rem"}}>
                            <span
                                style={{
                                    position: "absolute",
                                    zIndex: 2,
                                    marginTop: "-8px",
                                    fontSize: "12px",
                                    userSelect: "none",
                                    pointerEvents: "none",
                                }}
                                className={"text-sm opacity-80"}>
                                Cloze Id:
                            </span>
                            <select
                                ref={cidSelectorRef}
                                onChange={onCIdChange}
                                className="form-select is-small"
                                style={{
                                    position: "absolute",
                                    zIndex: 1,
                                    margin: "0",
                                    width: "80px",
                                    height: "1.8rem",
                                }}>
                                {_.range(1, 10).map((i) => (
                                    <option key={i} value={i}>
                                        {i}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </span>
                    <span
                        style={{
                            alignItems: "center",
                            justifyItems: "center",
                            paddingLeft: "0.5rem",
                            paddingRight: "0.5rem",
                            borderRight: "1px solid var(--ls-border-color)",
                        }}>
                        <div className={"anki_de"}>
                            <LogseqButton color={"default"} size={"sm"} icon={SETTINGS_ICON} />
                            <div className={"image-occlusion-menu"}>
                                <LogseqCheckbox
                                    checked={tags.includes("hide-all-test-one")}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setTags([...tags, "hide-all-test-one"]);
                                        } else {
                                            setTags(tags.filter(t => t !== "hide-all-test-one"));
                                        }
                                    }}>
                                    Hide All, Test One (
                                    <abbr title="When enabled, hides all occlusions including the one being tested during anki review.">
                                        ?
                                    </abbr>
                                    )
                                </LogseqCheckbox>
                                <hr style={{margin: "0.5rem"}} />
                                <div style={{marginLeft: "auto", marginRight: "auto"}}>
                                    <LogseqButton
                                        color={"primary"}
                                        size={"sm"}
                                        title={"Generate Occlusions using AI"}
                                        onClick={aiGenerateOcclusion}
                                        disabled={isAIGeneratingOcclusion}>
                                        {!isAIGeneratingOcclusion
                                            ? "Generate Occlusions using AI"
                                            : "Generating occlusions..."}
                                    </LogseqButton>
                                </div>
                            </div>
                        </div>
                    </span>
                    <span style={{paddingLeft: "0.5rem"}} />
                    <LogseqButton
                        color={"success"}
                        size={"sm"}
                        title={"Add Occlusion"}
                        onClick={addOcclusion}
                        icon={ADD_OCCLUSION_ICON}
                    />
                    <LogseqButton
                        color={"failed"}
                        size={"sm"}
                        title={"Delete Occlusion"}
                        onClick={deleteOcclusion}
                        icon={REMOVE_OCCLUSION_ICON}
                        disabled={fabricSelection == null || fabricSelection.length == 0}
                    />
                </div>
                <div style={{maxHeight: "70vh"}}>
                    <div
                        className="cloze-editor-canvas-container flex mt-1"
                        style={{justifyContent: "center"}}>
                        <canvas ref={canvasRef} />
                    </div>
                </div>
                <DialogModalFooter
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    confirmText="Confirm"
                    cancelText="Cancel"
                />
            </div>
        </Modal>
    );
};