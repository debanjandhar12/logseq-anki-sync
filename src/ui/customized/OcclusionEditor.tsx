import React, {useState, useEffect, useCallback, useRef} from "react";
import ReactDOM from "react-dom";
import _ from "lodash";
import fabric from "fabric/dist/fabric.js?string";
import path from "path-browserify";
import {
    ADD_OCCLUSION_ICON,
    ANKI_ICON,
    DONATE_ICON,
    isWebURL_REGEXP,
    REMOVE_OCCLUSION_ICON,
    SETTINGS_ICON,
} from "../../constants";
import {Modal} from "../general/Modal";
import {LogseqButton} from "../basic/LogseqButton";
import {LogseqDropdownMenu} from "../basic/LogseqDropdownMenu";
import {LogseqCheckbox} from "../basic/LogseqCheckbox";
import {createWorker, PSM} from "tesseract.js";

if (!window.parent.fabric) {
    const fabricScript = window.parent.document.createElement("script");
    fabricScript.innerHTML = fabric;
    window.parent.document.body.appendChild(fabricScript);
}

export type OcclusionElement = {
    left: number;
    top: number;
    width: number;
    height: number;
    angle: number;
    cId: number;
};

export type OcclusionConfig = {
    hideAllTestOne?: boolean;
};

export type OcclusionData = {
    config: OcclusionConfig;
    elements: Array<OcclusionElement>;
};

export async function OcclusionEditor(
    imgURL: string,
    occlusionElements: Array<OcclusionElement>,
    occlusionConfig: OcclusionConfig,
): Promise<OcclusionData | boolean> {
    return new Promise(async function (resolve, reject) {
        try {
            const main = window.parent.document.querySelector("#root main");
            const div = window.parent.document.createElement("div");
            div.className = "occlusion__editor";
            main?.appendChild(div);
            let onClose = () => {
                try {
                    ReactDOM.unmountComponentAtNode(div);
                    div.remove();
                } catch (e) {}
            };
            onClose = onClose.bind(this);
            ReactDOM.render(
                <OcclusionEditorComponent
                    imgURL={imgURL}
                    occlusionElements={occlusionElements}
                    occlusionConfig={occlusionConfig}
                    resolve={resolve}
                    reject={reject}
                    onClose={onClose}
                />,
                div,
            );
        } catch (e) {
            logseq.App.showMsg("Error", "Failed to open modal");
            console.log(e);
            reject(e);
        }
    });
}

const OcclusionEditorComponent: React.FC<{
    imgURL: string;
    occlusionElements: Array<OcclusionElement>;
    occlusionConfig: OcclusionConfig;
    resolve: (value: OcclusionData | boolean) => void;
    reject: Function;
    onClose: () => void;
}> = ({imgURL, occlusionElements, occlusionConfig, resolve, reject, onClose}) => {
    const [open, setOpen] = useState(true);
    const [occlusionConfigState, setOcclusionConfigState] = React.useState<OcclusionConfig>(
        occlusionConfig || {},
    );
    const fabricRef = React.useRef<any>();
    const canvasRef = React.useRef(null);
    const cidSelectorRef = React.useRef(null);
    const [imgEl, setImgEl] = React.useState(new window.parent.Image());
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
        resolve({
            config: occlusionConfigState,
            elements: newOcclusionElements,
        });
        onClose();
    };
    const handleCancel = () => {
        resolve(false);
        onClose();
    };

    React.useEffect(() => {
        const initFabric = async () => {
            fabricRef.current = new window.parent.fabric.Canvas(canvasRef.current, {
                stateful: true,
            });
            fabricRef.current.selection = false; // disable group selection
            fabricRef.current.uniformScaling = false; // disable object scaling keeping aspect ratio

            // Load the image and then add the occlusion rectangles
            imgEl.setAttribute("crossOrigin", "anonymous");
            const graphPath = (await logseq.App.getCurrentGraph()).path;
            imgEl.src = isWebURL_REGEXP.test(imgURL)
                ? imgURL
                : encodeURI(path.join(graphPath, path.resolve(imgURL)));
            imgEl.onload = function () {
                const img = new window.parent.fabric.Image(imgEl);
                const canvasWidth = Math.min(
                    imgEl.width,
                    window.parent.document.querySelector(".occlusion__editor").clientWidth -
                        160,
                );
                const canvasHeight = Math.min(
                    imgEl.height,
                    window.parent.document.body.clientHeight - 340,
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
            fabricRef.current.dispose();
        };
        initFabric();
        return () => {
            disposeFabric();
        };
    }, [open]);

    // Handle Selection
    const [fabricSelection, setFabricSelection] = React.useState<Array<fabric.Object>>([]);
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
                window.parent.fabric.Group.prototype.lockScalingX = true;
                window.parent.fabric.Group.prototype.lockScalingY = true;
                window.parent.fabric.Group.prototype.lockRotation = true;
                // window.parent.fabric.Group.prototype.lockMovementX = true;
                // window.parent.fabric.Group.prototype.lockMovementY = true;
                fabricRef.current.renderAll();
            } else {
                window.parent.fabric.Group.prototype.lockScalingX = false;
                window.parent.fabric.Group.prototype.lockScalingY = false;
                window.parent.fabric.Group.prototype.lockRotation = false;
                // window.parent.fabric.Group.prototype.lockMovementX = false;
                // window.parent.fabric.Group.prototype.lockMovementY = false;
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
                fabricRef.current.discardActiveObjects();
                fabricRef.current.renderAll();
                e.preventDefault();
                e.stopImmediatePropagation();
            } else if (e.key === "Escape") {
                onClose();
                e.preventDefault();
                e.stopImmediatePropagation();
            }
            if (e.ctrlKey && e.key === "a") {
                fabricRef.current.discardActiveObject();
                var sel = new window.parent.fabric.ActiveSelection(
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
        window.parent.document.addEventListener("keydown", onKeydown, {
            capture: true,
        });
        return () => {
            window.parent.document.removeEventListener("keydown", onKeydown, {capture: true});
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
            worker = await createWorker("eng", 3, {});
            await worker.setParameters({tessedit_pageseg_mode: PSM.SPARSE_TEXT});
            const ret = await worker.recognize(imgEl.src);
            let counter = 0;
            if (!ret.data.confidence || ret.data.confidence < 40)
                throw new Error("AI failed to recognize the image");
            console.log(ret);
            for (const paragraph of _.get(ret, "data.paragraphs", [])) {
                const width = paragraph.bbox.x1 - paragraph.bbox.x0;
                const height = paragraph.bbox.y1 - paragraph.bbox.y0;

                // Ignore low confidence paragraphs
                if (paragraph.confidence < 40) continue;
                // Ignore small occlusions
                if (width < 4 || height < 4) continue;
                if (width * height < Math.pow(0.025, 2) * imgEl.width * imgEl.height) continue;
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
                    if (
                        doRectsCollide(
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
                            },
                        )
                    ) {
                        intersects = true;
                        break;
                    }
                }
                if (intersects) continue;

                const occlusionEl = createOcclusionRectEl(
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
            onClose={onClose}
            hasCloseButton={false}
            size={"large"}>
            <div className="settings-modal of-plugins">
                <div className="absolute top-0 right-0 pt-2 pr-3">
                    <a href="https://github.com/sponsors/debanjandhar12">
                        <img alt="Donate" style={{height: "1.4rem"}} src={DONATE_ICON} />
                    </a>
                </div>
                <header
                    style={{
                        borderBottom: "1px solid var(--ls-quaternary-background-color)",
                        padding: "8px 12px",
                    }}>
                    <h3 className="title inline-flex items-center" style={{marginTop: "2px"}}>
                        <i className="px-1" dangerouslySetInnerHTML={{__html: ANKI_ICON}}></i>
                        <strong>Occlusion Editor</strong>
                    </h3>
                </header>
                <div
                    style={{
                        borderBottom: "1px solid var(--ls-quaternary-background-color)",
                        alignItems: "center",
                        justifyContent: "end",
                    }}
                    className="occlusion-editor-toolbar flex">
                    {zoomView && (
                        <span
                            className={"text-sm opacity-80"}
                            style={{
                                paddingLeft: "0.25rem",
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
                            borderRight: "1px solid var(--ls-quaternary-background-color)",
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
                        className={"anki_de"}
                        style={{
                            alignItems: "center",
                            justifyItems: "center",
                            paddingLeft: "0.5rem",
                            paddingRight: "0.5rem",
                            borderRight: "1px solid var(--ls-quaternary-background-color)",
                        }}>
                        <LogseqButton color={"default"} size={"sm"} icon={SETTINGS_ICON} />
                        <div className={"image-occlusion-menu"}>
                            <LogseqCheckbox
                                checked={occlusionConfigState.hideAllTestOne}
                                onChange={(e) =>
                                    setOcclusionConfigState({
                                        ...occlusionConfigState,
                                        hideAllTestOne: e.target.checked,
                                    })
                                }>
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
                <div
                    className="mt-1 sm:flex sm:flex-row-reverse"
                    style={{
                        borderTop: "1px solid var(--ls-quaternary-background-color)",
                        padding: "2px",
                        alignItems: "center",
                    }}>
                    <span className="flex w-full rounded-md shadow-sm sm:ml-3 sm:w-auto">
                        <LogseqButton
                            isFullWidth={true}
                            depth={1}
                            onClick={() => handleConfirm()}
                            color="primary">
                            <span
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                <span>Confirm</span>
                                <span
                                    className="opacity-80 ui__button-shortcut-key"
                                    style={{marginLeft: "2px"}}>
                                    ⏎
                                </span>
                            </span>
                        </LogseqButton>
                    </span>
                    <span className="flex w-full rounded-md shadow-sm sm:ml-3 sm:w-auto">
                        <LogseqButton
                            isFullWidth={true}
                            depth={1}
                            onClick={() => handleCancel()}>
                            Cancel
                        </LogseqButton>
                    </span>
                </div>
            </div>
        </Modal>
    );
};

export function createOcclusionRectEl(
    left = 0,
    top = 0,
    width = 80,
    height = 40,
    angle = 0,
    cId = 1,
) {
    const rect = new window.parent.fabric.Rect({
        fill: "#FFEBA2",
        stroke: "#000",
        strokeWidth: 1,
        strokeUniform: true,
        noScaleCache: false,
        opacity: 0.8,
        width: width,
        height: height,
        originX: "center",
        originY: "center",
    });
    const text = new window.parent.fabric.Text(`${cId}`, {
        originX: "center",
        originY: "center",
    });
    text.scaleToHeight(height);
    const group = new window.parent.fabric.Group([rect, text], {
        left: left,
        top: top,
        width: width,
        height: height,
        originX: "center",
        originY: "center",
        angle: angle,
    });
    return group;
}
