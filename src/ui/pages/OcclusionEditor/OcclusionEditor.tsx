import {fabric} from "fabric";
import React from "react";
import {ANKI_ICON, DONATE_ICON} from "../../../constants";
import {WindowBridge} from "../../../logseq/WindowBridge";
import {createOcclusionRectEl, updateOcclusionHint} from "../../../utils/occlusionUtils";
import useUndo from "../../hooks/useUndo";
import {showConfirmModal} from "../../launchers/showConfirmModal";
import {showInputModal} from "../../launchers/showInputModal";
import type {OcclusionData} from "../../launchers/showOcclusionEditor";
import {Modal} from "../../modals/core/Modal";
import {DialogModalFooter} from "../../modals/core/ModalFooter";
import {ModalHeader} from "../../modals/core/ModalHeader";
import {useModal} from "../../modals/hooks/useModal";
import {UI} from "../../UI";
import {OcclusionToolbar} from "./OcclusionToolbar";
import {serializeOcclusionElements} from "./serializeOcclusionElements";
import type {OcclusionEditorProps, ToolType} from "./types";
import {useGenerateOcclusions} from "./useGenerateOcclusions";
import {useOcclusionCanvas} from "./useOcclusionCanvas";
import {useOcclusionCanvasHistory} from "./useOcclusionCanvasHistory";
import {useOcclusionKeyboard} from "./useOcclusionKeyboard";
import {useOcclusionSelection} from "./useOcclusionSelection";
import {useOcclusionViewport} from "./useOcclusionViewport";
import {createOcclusionElement} from "./utils/createOcclusionElement";

export const OcclusionEditorComponent: React.FC<OcclusionEditorProps> = ({
    imgURL,
    occlusionElements,
    occlusionConfig,
    blockTags,
    resolve,
    modalContext
}) => {
    const {open, setOpen, returnResult} = useModal<OcclusionData | boolean>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: false, // We'll handle Escape key manually due to complex interactions
        enableEnterKey: false, // We'll handle Enter key manually
        enableOutsideClickClose: false,
        modalId: modalContext?.modalId
    });
    const [tags, setTags] = React.useState<string[]>(blockTags);
    const fabricRef = React.useRef<any>(undefined);
    const canvasRef = React.useRef(null);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [imgEl] = React.useState(WindowBridge.createElement("img"));

    // Zoom state (5% to 200%)
    const [zoomLevel, setZoomLevel] = React.useState<number>(100);

    // Tool state
    const [activeTool, setActiveTool] = React.useState<ToolType>("select");

    // Cloze ID state for select component
    const [clozeId, setClozeId] = React.useState<string>("1");

    // Store initial elements in a ref to ensure stable hook initialization
    const initialElementsRef = React.useRef(occlusionElements);

    // Undo/Redo state for occlusion elements
    const [
        occlusionState,
        {set: setOcclusionElements, undo: undoOcclusion, redo: redoOcclusion, canUndo, canRedo}
    ] = useUndo(initialElementsRef.current);

    // Store original image dimensions for coordinate calculations
    const imageDimensions = React.useRef<{width: number; height: number}>({
        width: 0,
        height: 0
    });

    const handleConfirm = () => {
        const newOcclusionElements = serializeOcclusionElements(fabricRef.current.getObjects());

        returnResult({
            config: occlusionConfig,
            elements: newOcclusionElements,
            tags: tags
        });
    };

    const handleCancel = async () => {
        if (canUndo) {
            const confirmed = await showConfirmModal(
                "You have unsaved changes. Are you sure you want to close the Occlusion Editor?",
                {confirmText: "Discard", cancelText: "Cancel"}
            );
            if (!confirmed) return;
        }
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
            initialValue: currentHint
        });

        if (hint !== null) {
            updateOcclusionHint(selectedObj, hint, fabric);
            fabricRef.current.renderAll();
            setFabricSelection([...fabricSelection]); // Force re-render
            saveCanvasState(); // Save to undo history
        }
    };

    useOcclusionCanvas({
        open,
        imgURL,
        imgEl,
        occlusionElements,
        fabricRef,
        canvasRef,
        imageDimensions,
        setZoomLevel
    });

    const saveCanvasState = useOcclusionCanvasHistory(
        fabricRef,
        imgEl,
        occlusionState.present,
        setOcclusionElements,
        open
    );

    const {fabricSelection, setFabricSelection} = useOcclusionSelection(
        fabricRef,
        imgEl,
        open,
        setClozeId
    );

    const handleZoomChange = useOcclusionViewport({
        fabricRef,
        imageDimensions,
        scrollContainerRef,
        activeTool,
        open,
        modalId: modalContext?.modalId,
        zoomLevel,
        setZoomLevel
    });

    const addOcclusion = () => {
        const scrollContainer = scrollContainerRef.current;
        const zoom = fabricRef.current?.getZoom();
        const newElement = createOcclusionElement(
            imgEl,
            occlusionState.present,
            scrollContainer && fabricRef.current
                ? {
                      left: scrollContainer.scrollLeft / zoom,
                      top: scrollContainer.scrollTop / zoom,
                      width: scrollContainer.clientWidth / zoom,
                      height: scrollContainer.clientHeight / zoom
                  }
                : undefined
        );

        const occlusionEl = createOcclusionRectEl(
            fabric,
            newElement.left,
            newElement.top,
            newElement.width,
            newElement.height,
            newElement.angle,
            newElement.cId,
            newElement.hint
        );
        fabricRef.current.add(occlusionEl);
        fabricRef.current.setActiveObject(occlusionEl);
        fabricRef.current.renderAll();
        saveCanvasState();
    };
    const deleteOcclusion = () => {
        if (!fabricRef.current) return;
        const activeObjects = fabricRef.current.getActiveObjects();
        if (activeObjects.length === 0) return;

        activeObjects.forEach((obj: any) => {
            fabricRef.current.remove(obj);
        });
        fabricRef.current.discardActiveObject();
        fabricRef.current.renderAll();
        saveCanvasState();
    };
    const onCIdChange = (value: string) => {
        if (!fabricSelection || !Array.isArray(fabricSelection)) return;
        fabricSelection.forEach((obj) => {
            if (obj?._objects?.[1]) {
                obj._objects[1].set("text", value);
            }
        });
        fabricRef.current.renderAll();
        saveCanvasState(); // Save to undo history
    };
    useOcclusionKeyboard({
        open,
        modalId: modalContext?.modalId,
        fabricRef,
        activeTool,
        canUndo,
        canRedo,
        undo: undoOcclusion,
        redo: redoOcclusion,
        confirm: handleConfirm,
        cancel: handleCancel,
        addOcclusion,
        deleteOcclusion,
        changeClozeId: (value) => {
            setClozeId(value);
            onCIdChange(value);
        }
    });
    const {isAIGeneratingOcclusion, aiGenerateOcclusion} = useGenerateOcclusions(
        fabricRef,
        imgEl,
        saveCanvasState
    );

    return (
        <Modal
            open={open}
            setOpen={setOpen}
            onClose={() => UI.hideModal(modalContext?.modalId)}
            hasCloseButton={false}
            size={"large"}>
            <div
                style={{
                    margin: "0rem",
                    display: "flex",
                    flexDirection: "column",
                    maxHeight: "80vh"
                }}>
                <ModalHeader
                    title="Occlusion Editor"
                    icon={ANKI_ICON}
                    onClose={handleCancel}
                    showCloseButton={true}>
                    <a
                        href="https://github.com/sponsors/debanjandhar12"
                        target={"_blank"}
                        rel="noopener">
                        <img alt="Donate" style={{height: "1.4rem"}} src={DONATE_ICON} />
                    </a>
                </ModalHeader>
                <OcclusionToolbar
                    activeTool={activeTool}
                    setActiveTool={setActiveTool}
                    zoomLevel={zoomLevel}
                    onZoomChange={handleZoomChange}
                    selection={fabricSelection}
                    clozeId={clozeId}
                    onClozeIdChange={(value) => {
                        setClozeId(value);
                        onCIdChange(value);
                    }}
                    onHint={handleHintClick}
                    onAdd={addOcclusion}
                    onDelete={deleteOcclusion}
                    tags={tags}
                    setTags={setTags}
                    generating={isAIGeneratingOcclusion}
                    onGenerate={aiGenerateOcclusion}
                />
                <div
                    ref={scrollContainerRef}
                    className="overflow-y-auto"
                    style={{flex: 1, overflow: "auto", minHeight: 0}}>
                    <div
                        className="cloze-editor-canvas-container"
                        style={{
                            display: "inline-block",
                            margin: "0.5rem 1rem 1rem 1rem"
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
