import React, {useState, useEffect, useCallback, useRef} from "../React";
import _ from "lodash";
import {fabric} from "fabric";
import {ANKI_ICON, DONATE_ICON, isWebURL_REGEXP} from "../../constants";
import ADD_OCCLUSION_ICON from "../../../node_modules/@tabler/icons/icons/outline/square-plus-2.svg?raw";
import REMOVE_OCCLUSION_ICON from "../../../node_modules/@tabler/icons/icons/outline/square-minus.svg?raw";
import SETTINGS_ICON from "../../../node_modules/@tabler/icons/icons/outline/settings.svg?raw";
import HAND_ICON from "../../../node_modules/@tabler/icons/icons/outline/hand-stop.svg?raw";
import SELECT_ICON from "../../../node_modules/@tabler/icons/icons/outline/click.svg?raw";
import HINT_ICON from "../../../node_modules/@tabler/icons/icons/outline/bulb.svg?raw";
import {
    Modal,
    useModal,
    createModalPromise,
    ModalHeader,
    DialogModalFooter,
    showInputModal,
} from "../";
import {LogseqButton} from "../components/LogseqButton";
import {LogseqCheckbox} from "../components/LogseqCheckbox";
import {createWorker, PSM} from "tesseract.js";
import {UI} from "../UI";
import {createOcclusionRectEl, updateOcclusionHint} from "../../utils/occlusionUtils";
import {WindowBridge} from "../../logseq/WindowBridge";

import {createLogger, LoggerCategory} from "../../utils/logger";
import {WindowParentBridge} from "../../logseq/WindowParentBridge";

const logger = createLogger(LoggerCategory.Others);

export type OcclusionElement = {
    left: number;
    top: number;
    width: number;
    height: number;
    angle: number;
    cId: number;
    hint?: string;
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

// Tool types for the toolbar
type ToolType = "select" | "hand";

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
        {errorMessage: "Failed to open Occlusion Editor"},
    );
}

const OcclusionEditorComponent: React.FC<{
    imgURL: string;
    occlusionElements: Array<OcclusionElement>;
    occlusionConfig: OcclusionConfig;
    blockTags: string[];
    resolve: (value: OcclusionData | boolean) => void;
    reject: Function;
    modalContext?: {modalId: string | null};
}> = ({
    imgURL,
    occlusionElements,
    occlusionConfig,
    blockTags,
    resolve,
    reject,
    modalContext,
}) => {
    const {open, setOpen, returnResult} = useModal<OcclusionData | boolean>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: false, // We'll handle Escape key manually due to complex interactions
        enableEnterKey: false, // We'll handle Enter key manually
        modalId: modalContext?.modalId,
    });
    const [tags, setTags] = React.useState<string[]>(blockTags);
    const fabricRef = React.useRef<any>();
    const canvasRef = React.useRef(null);
    const cidSelectorRef = React.useRef(null);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [imgEl, setImgEl] = React.useState(WindowBridge.createElement("img"));

    // Zoom state (5% to 200%)
    const [zoomLevel, setZoomLevel] = React.useState<number>(100);
    const [initialZoom, setInitialZoom] = React.useState<number>(1);

    // Tool state
    const [activeTool, setActiveTool] = React.useState<ToolType>("select");

    // Store original image dimensions for coordinate calculations
    const imageDimensions = React.useRef<{width: number; height: number}>({
        width: 0,
        height: 0,
    });

    const handleConfirm = () => {
        const newOcclusionElements = fabricRef.current.getObjects().map((obj) => {
            // https://github.com/fabricjs/fabric.js/issues/801#issuecomment-218116910
            const matrix = obj.calcTransformMatrix();
            const actualTop = matrix[5];
            const actualLeft = matrix[4];

            const element: OcclusionElement = {
                left: actualLeft,
                top: actualTop,
                width: obj.getScaledWidth(),
                height: obj.getScaledHeight(),
                angle: obj.angle,
                cId: parseInt(obj._objects[1].text),
            };

            // Include hint if it exists on the object
            if (obj.hint) {
                element.hint = obj.hint;
            }

            return element;
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

    // Handle hint button click
    const handleHintClick = async () => {
        if (!fabricSelection || fabricSelection.length !== 1) return;

        const selectedObj = fabricSelection[0];
        const currentHint = selectedObj.hint || "";

        const hint = await showInputModal({
            title: "Set Hint",
            message: "Enter a hint for this occlusion (shown in front side):",
            placeholder: "Type a hint...",
            initialValue: currentHint,
        });

        if (hint !== null) {
            updateOcclusionHint(selectedObj, hint, fabric);
            fabricRef.current.renderAll();
            setFabricSelection([...fabricSelection]); // Force re-render
        }
    };

    // Apply zoom to canvas
    const applyZoom = useCallback((newZoomPercent: number) => {
        if (!fabricRef.current || !imageDimensions.current.width) return;

        const newZoom = newZoomPercent / 100;
        fabricRef.current.setZoom(newZoom);
        fabricRef.current.setWidth(imageDimensions.current.width * newZoom);
        fabricRef.current.setHeight(imageDimensions.current.height * newZoom);
        fabricRef.current.renderAll();
    }, []);

    // Handle zoom slider change
    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newZoom = parseInt(e.target.value, 10);
        setZoomLevel(newZoom);
        applyZoom(newZoom);
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
                // Use Logseq's asset API to get a proper URL
                imgEl.src = await WindowParentBridge.makeAssetUrl(imgURL);
            }

            imgEl.onload = function () {
                // Check if component is still mounted before proceeding
                if (!isMounted || !fabricRef.current) {
                    return;
                }

                const img = new fabric.Image(imgEl);
                const appRoot = WindowBridge.getElementById("app");
                const canvasWidth = Math.min(imgEl.width, appRoot?.clientWidth - 160 || 800);
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

                // Store image dimensions for zoom calculations
                imageDimensions.current = {width: imgEl.width, height: imgEl.height};
                setInitialZoom(scale);

                // Set initial zoom level (as percentage)
                const initialZoomPercent = Math.round(scale * 100);
                setZoomLevel(initialZoomPercent);

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
                        obj.hint,
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

    // Prevent out of bounds - https://stackoverflow.com/a/42915768
    React.useEffect(() => {
        if (!fabricRef || !fabricRef.current) return;
        const preventOutOfBounds = (e: any) => {
            const obj = e.target;
            const angleRad = obj.angle * (Math.PI / 180);

            // Calculate dimensions of the bounding box of the rotated object (in Scene space)
            const w = obj.getScaledWidth();
            const h = obj.getScaledHeight();
            const sceneH = Math.abs(w * Math.sin(angleRad)) + Math.abs(h * Math.cos(angleRad));
            const sceneW = Math.abs(w * Math.cos(angleRad)) + Math.abs(h * Math.sin(angleRad));

            if (obj.originX === "center") {
                // If origin is center, obj.left/top are the center coordinates
                const xMin = sceneW / 2;
                const xMax = imgEl.width - sceneW / 2;
                const yMin = sceneH / 2;
                const yMax = imgEl.height - sceneH / 2;

                obj.left = Math.min(Math.max(obj.left, xMin), xMax);
                obj.top = Math.min(Math.max(obj.top, yMin), yMax);
            } else {
                // Fallback for non-center origin (if any elements use it)
                obj.left = Math.min(
                    Math.max(obj.left, 0),
                    imgEl.width - sceneW, // Approximation for non-center
                );
                obj.top = Math.min(Math.max(obj.top, 0), imgEl.height - sceneH);
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

    // Update canvas interaction and cursor based on active tool
    React.useEffect(() => {
        if (!fabricRef.current) return;

        if (activeTool === "hand") {
            // Disable object selection when hand tool is active
            fabricRef.current.selection = false;
            fabricRef.current.defaultCursor = "grab";
            fabricRef.current.hoverCursor = "grab";
            fabricRef.current.forEachObject((obj: any) => {
                obj.selectable = false;
                obj.evented = false;
            });
        } else {
            // Enable object selection when select tool is active
            fabricRef.current.selection = true;
            fabricRef.current.defaultCursor = "default";
            fabricRef.current.hoverCursor = "move";
            fabricRef.current.forEachObject((obj: any) => {
                obj.selectable = true;
                obj.evented = true;
            });
        }
        fabricRef.current.renderAll();
    }, [activeTool]);

    // Handle panning with hand tool using fabric mouse events
    React.useEffect(() => {
        if (!fabricRef.current || !scrollContainerRef.current) return;

        const canvas = fabricRef.current;
        const scrollContainer = scrollContainerRef.current;
        let localIsPanning = false;
        let startX = 0;
        let startY = 0;
        let startScrollLeft = 0;
        let startScrollTop = 0;

        const handleMouseDown = (opt: any) => {
            if (activeTool !== "hand") return;
            localIsPanning = true;
            canvas.defaultCursor = "grabbing";
            startX = opt.e.clientX;
            startY = opt.e.clientY;
            startScrollLeft = scrollContainer.scrollLeft;
            startScrollTop = scrollContainer.scrollTop;
            opt.e.preventDefault();
        };

        const handleMouseMove = (opt: any) => {
            if (!localIsPanning) return;
            const dx = opt.e.clientX - startX;
            const dy = opt.e.clientY - startY;
            scrollContainer.scrollLeft = startScrollLeft - dx;
            scrollContainer.scrollTop = startScrollTop - dy;
        };

        const handleMouseUp = () => {
            if (localIsPanning) {
                localIsPanning = false;
                if (activeTool === "hand") {
                    canvas.defaultCursor = "grab";
                }
            }
        };

        canvas.on("mouse:down", handleMouseDown);
        canvas.on("mouse:move", handleMouseMove);
        canvas.on("mouse:up", handleMouseUp);

        return () => {
            canvas.off("mouse:down", handleMouseDown);
            canvas.off("mouse:move", handleMouseMove);
            canvas.off("mouse:up", handleMouseUp);
        };
    }, [activeTool]);

    // Handle some key events
    React.useEffect(() => {
        if (!fabricRef || !open) return;
        const onKeydown = (e: KeyboardEvent) => {
            if (!fabricRef || !open) return;

            if (UI.getActiveModal() !== modalContext?.modalId) {
                return;
            }

            // Escape key handling
            if (e.key === "Escape" && fabricRef.current.getActiveObjects().length > 0) {
                logger.info(fabricRef);
                fabricRef.current.discardActiveObject();
                fabricRef.current.renderAll();
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            } else if (e.key === "Escape") {
                handleCancel();
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }

            // Ctrl+A - Select all (only in select mode)
            if (e.ctrlKey && e.key === "a") {
                if (activeTool !== "select") return;
                fabricRef.current.discardActiveObject();
                var sel = new fabric.ActiveSelection(fabricRef.current.getObjects(), {
                    canvas: fabricRef.current,
                });
                fabricRef.current.setActiveObject(sel);
                fabricRef.current.renderAll();
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }

            if (e.key === "Enter") {
                handleConfirm();
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }

            // Delete - Delete selected occlusion
            if (e.key === "Delete" && fabricRef.current.getActiveObjects().length > 0) {
                deleteOcclusion();
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }

            // Insert - Add occlusion
            if (e.key === "Insert") {
                addOcclusion();
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }

            // Arrow keys - Move selection if active, otherwise let Modal.tsx handle scrolling
            const activeObject = fabricRef.current.getActiveObject();
            if (e.key === "ArrowUp") {
                if (activeObject && activeTool === "select") {
                    activeObject.top -= 1;
                    fabricRef.current.renderAll();
                    fabricRef.current.fire("object:modified", {
                        target: activeObject,
                    });
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
                // If no selection, don't prevent default - let Modal.tsx handle scrolling
            }
            if (e.key === "ArrowDown") {
                if (activeObject && activeTool === "select") {
                    activeObject.top += 1;
                    fabricRef.current.renderAll();
                    fabricRef.current.fire("object:modified", {
                        target: activeObject,
                    });
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
                // If no selection, don't prevent default - let Modal.tsx handle scrolling
            }
            if (e.key === "ArrowLeft") {
                if (activeObject && activeTool === "select") {
                    activeObject.left -= 1;
                    fabricRef.current.renderAll();
                    fabricRef.current.fire("object:modified", {
                        target: activeObject,
                    });
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
                // If no selection, don't prevent default - let Modal.tsx handle scrolling
            }
            if (e.key === "ArrowRight") {
                if (activeObject && activeTool === "select") {
                    activeObject.left += 1;
                    fabricRef.current.renderAll();
                    fabricRef.current.fire("object:modified", {
                        target: activeObject,
                    });
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
                // If no selection, don't prevent default - let Modal.tsx handle scrolling
            }

            // Number keys 1-9 - Change cloze ID
            if (e.key >= "1" && e.key <= "9") {
                if (activeObject && activeTool === "select") {
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
    }, [fabricRef, open, activeTool]);

    // Create the UI
    const addOcclusion = () => {
        const occlusionWidth = 0.22 * imgEl.width;
        const occlusionHeight = 0.22 * imgEl.height;

        const usedCIds = fabricRef.current
            .getObjects()
            .map((obj) => parseInt(obj._objects[1].text));
        let newCId = 1;
        while (usedCIds.includes(newCId) && newCId < 10) newCId++;
        if (newCId > 9) newCId = 1;

        let x: number, y: number;

        // Try to place occlusion within visible viewport
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer && fabricRef.current) {
            const zoom = fabricRef.current.getZoom();
            const visibleLeft = scrollContainer.scrollLeft / zoom;
            const visibleTop = scrollContainer.scrollTop / zoom;
            const visibleWidth = scrollContainer.clientWidth / zoom;
            const visibleHeight = scrollContainer.clientHeight / zoom;

            // Calculate bounds for placing occlusion within visible area
            const minX = Math.max(occlusionWidth / 2, visibleLeft + occlusionWidth / 2);
            const maxX = Math.min(
                imgEl.width - occlusionWidth / 2,
                visibleLeft + visibleWidth - occlusionWidth / 2,
            );
            const minY = Math.max(occlusionHeight / 2, visibleTop + occlusionHeight / 2);
            const maxY = Math.min(
                imgEl.height - occlusionHeight / 2,
                visibleTop + visibleHeight - occlusionHeight / 2,
            );

            if (maxX > minX && maxY > minY) {
                // Place within visible area
                x = minX + Math.random() * (maxX - minX);
                y = minY + Math.random() * (maxY - minY);
            } else {
                // Visible area too small, use random placement
                x =
                    Math.floor(Math.random() * (imgEl.width - occlusionWidth)) +
                    occlusionWidth / 2 +
                    0.11 * imgEl.width;
                y =
                    Math.floor(Math.random() * (imgEl.height - occlusionHeight)) +
                    occlusionHeight / 2 +
                    0.11 * imgEl.height;
            }
        } else {
            // Fallback to random placement
            x =
                Math.floor(Math.random() * (imgEl.width - occlusionWidth)) +
                occlusionWidth / 2 +
                0.11 * imgEl.width;
            y =
                Math.floor(Math.random() * (imgEl.height - occlusionHeight)) +
                occlusionHeight / 2 +
                0.11 * imgEl.height;
        }

        const occlusionEl = createOcclusionRectEl(
            fabric,
            x,
            y,
            occlusionWidth,
            occlusionHeight,
            0,
            newCId,
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
                langPath: "https://tessdata.projectnaptha.com/4.0.0_best",
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
                if (paragraph.text.trim().length < Math.min(avgParagraphTextLength / 2, 3))
                    continue;

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
            enableEscapeKeyClose={false}
            enableOutsideClickClose={false}
            size={"large"}>
            <div
                style={{
                    margin: "0rem",
                    display: "flex",
                    flexDirection: "column",
                    maxHeight: "80vh",
                }}>
                <ModalHeader
                    title="Occlusion Editor"
                    icon={ANKI_ICON}
                    onClose={() => setOpen(false)}
                    showCloseButton={true}>
                    <a href="https://github.com/sponsors/debanjandhar12" target={"_blank"}>
                        <img alt="Donate" style={{height: "1.4rem"}} src={DONATE_ICON} />
                    </a>
                </ModalHeader>
                <div
                    style={{
                        borderBottom: "1px solid var(--ls-border-color)",
                        alignItems: "center",
                        justifyContent: "end",
                        flexShrink: 0,
                    }}
                    className="occlusion-editor-toolbar flex">
                    {/* Toolbar with select and hand tools */}
                    <span
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            paddingRight: "0.5rem",
                            borderRight: "1px solid var(--ls-border-color)",
                        }}>
                        <LogseqButton
                            color={activeTool === "select" ? "primary" : "ghost"}
                            size={"sm"}
                            title={"Select Tool (Select and move occlusions)"}
                            onClick={() => setActiveTool("select")}
                            icon={SELECT_ICON}
                        />
                        <LogseqButton
                            color={activeTool === "hand" ? "primary" : "ghost"}
                            size={"sm"}
                            title={"Hand Tool (Pan/scroll the canvas)"}
                            onClick={() => setActiveTool("hand")}
                            icon={HAND_ICON}
                        />
                    </span>

                    {/* Zoom slider */}
                    <span
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            paddingLeft: "0.5rem",
                            paddingRight: "0.5rem",
                            borderRight: "1px solid var(--ls-border-color)",
                            gap: "0.5rem",
                        }}>
                        <span className="text-sm opacity-80">Zoom:</span>
                        <input
                            type="range"
                            min="5"
                            max="200"
                            value={zoomLevel}
                            onChange={handleZoomChange}
                            style={{width: "100px"}}
                            className="zoom-slider"
                        />
                        <span className="text-sm opacity-80" style={{minWidth: "3rem"}}>
                            {zoomLevel}%
                        </span>
                    </span>
                    {/* Cloze id selector and hint button only shown when one or more occlusions are selected */}
                    <span
                        className={
                            fabricSelection && fabricSelection.length > 0 ? "flex" : "hidden"
                        }
                        style={{
                            alignItems: "center",
                            justifyItems: "center",
                            paddingLeft: "0.5rem",
                            paddingRight: "0.5rem",
                            borderRight: "1px solid var(--ls-border-color)",
                        }}>
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
                                    height: "inherit",
                                }}>
                                {_.range(1, 10).map((i) => (
                                    <option key={i} value={i}>
                                        {i}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {/* Hint button */}
                        {fabricSelection && fabricSelection.length === 1 && (
                            <LogseqButton
                                color={"primary"}
                                size={"sm"}
                                title={
                                    fabricSelection[0].hint
                                        ? `Hint: ${fabricSelection[0].hint}`
                                        : "Set Hint"
                                }
                                onClick={handleHintClick}
                                icon={HINT_ICON}
                            />
                        )}
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
                                            setTags(
                                                tags.filter((t) => t !== "hide-all-test-one"),
                                            );
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
                        isFullWidth={false}
                        title={"Add Occlusion"}
                        onClick={addOcclusion}
                        icon={ADD_OCCLUSION_ICON}
                    />
                    <LogseqButton
                        color={"failed"}
                        size={"sm"}
                        isFullWidth={false}
                        title={"Delete Occlusion"}
                        onClick={deleteOcclusion}
                        icon={REMOVE_OCCLUSION_ICON}
                        disabled={fabricSelection == null || fabricSelection.length == 0}
                    />
                </div>
                <div
                    ref={scrollContainerRef}
                    className="overflow-y-auto"
                    style={{flex: 1, overflow: "auto", minHeight: 0}}>
                    <div
                        className="cloze-editor-canvas-container"
                        style={{
                            display: "inline-block",
                            margin: "0.5rem 1rem 1rem 1rem",
                        }}>
                        <canvas ref={canvasRef} />
                    </div>
                </div>
                <DialogModalFooter
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    confirmText="Save"
                    cancelText="Cancel"
                />
            </div>
        </Modal>
    );
};
