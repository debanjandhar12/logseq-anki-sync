import React, {type RefObject, useCallback} from "react";
import {UI} from "../../UI";
import type {ToolType} from "./types";

export function useOcclusionViewport({
    fabricRef,
    imageDimensions,
    scrollContainerRef,
    activeTool,
    open,
    modalId,
    zoomLevel,
    setZoomLevel
}: {
    fabricRef: RefObject<any>;
    imageDimensions: RefObject<{width: number; height: number}>;
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    activeTool: ToolType;
    open: boolean;
    modalId?: string | null;
    zoomLevel: number;
    setZoomLevel: (value: number) => void;
}) {
    const applyZoom = useCallback(
        (percent: number) => {
            const canvas = fabricRef.current;
            if (!canvas || !imageDimensions.current.width) return;
            const zoom = percent / 100;
            canvas.setZoom(zoom);
            canvas.setWidth(imageDimensions.current.width * zoom);
            canvas.setHeight(imageDimensions.current.height * zoom);
            canvas.renderAll();
        },
        [fabricRef, imageDimensions]
    );
    const handleZoomChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const zoom = parseInt(event.target.value, 10);
        setZoomLevel(zoom);
        applyZoom(zoom);
    };
    React.useEffect(() => {
        if (!open) return;
        const canvas = fabricRef.current;
        if (!canvas) return;
        const selecting = activeTool === "select";
        canvas.selection = selecting;
        canvas.defaultCursor = selecting ? "default" : "grab";
        canvas.hoverCursor = selecting ? "move" : "grab";
        canvas.forEachObject((obj: any) => {
            obj.selectable = selecting;
            obj.evented = selecting;
        });
        canvas.renderAll();
    }, [fabricRef, activeTool, open]);
    React.useEffect(() => {
        if (!open) return;
        const canvas = fabricRef.current;
        const container = scrollContainerRef.current;
        if (!canvas || !container) return;
        let panning = false;
        let startX = 0,
            startY = 0,
            startLeft = 0,
            startTop = 0;
        const down = (opt: any) => {
            if (UI.getActiveModal() !== modalId || activeTool !== "hand") return;
            panning = true;
            canvas.defaultCursor = "grabbing";
            startX = opt.e.clientX;
            startY = opt.e.clientY;
            startLeft = container.scrollLeft;
            startTop = container.scrollTop;
            opt.e.preventDefault();
        };
        const move = (opt: any) => {
            if (UI.getActiveModal() !== modalId || !panning) return;
            container.scrollLeft = startLeft - (opt.e.clientX - startX);
            container.scrollTop = startTop - (opt.e.clientY - startY);
        };
        const up = () => {
            if (UI.getActiveModal() !== modalId || !panning) return;
            panning = false;
            if (activeTool === "hand") canvas.defaultCursor = "grab";
        };
        canvas.on("mouse:down", down);
        canvas.on("mouse:move", move);
        canvas.on("mouse:up", up);
        return () => {
            canvas.off("mouse:down", down);
            canvas.off("mouse:move", move);
            canvas.off("mouse:up", up);
        };
    }, [fabricRef, scrollContainerRef, activeTool, modalId, open]);
    React.useEffect(() => {
        const container = scrollContainerRef.current;
        if (!fabricRef.current || !container || !open) return;
        const wheel = (event: WheelEvent) => {
            if (!event.ctrlKey || UI.getActiveModal() !== modalId) return;
            event.preventDefault();
            const zoom = Math.max(5, Math.min(200, zoomLevel + (event.deltaY > 0 ? -10 : 10)));
            setZoomLevel(zoom);
            applyZoom(zoom);
        };
        container.addEventListener("wheel", wheel, {passive: false});
        return () => container.removeEventListener("wheel", wheel);
    }, [fabricRef, scrollContainerRef, open, modalId, zoomLevel, setZoomLevel, applyZoom]);
    return handleZoomChange;
}
