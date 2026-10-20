import {fabric} from "fabric";
import React from "react";
import {isWebURL_REGEXP} from "../../../constants";
import {WindowBridge} from "../../../logseq/WindowBridge";
import {WindowParentBridge} from "../../../logseq/WindowParentBridge";
import {createOcclusionRectEl} from "../../../utils/occlusionUtils";
import type {OcclusionElement} from "../../launchers/showOcclusionEditor";

export function useOcclusionCanvas({
    open,
    imgURL,
    imgEl,
    occlusionElements,
    fabricRef,
    canvasRef,
    imageDimensions,
    setZoomLevel
}: {
    open: boolean;
    imgURL: string;
    imgEl: HTMLImageElement;
    occlusionElements: OcclusionElement[];
    fabricRef: React.RefObject<any>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    imageDimensions: React.RefObject<{width: number; height: number}>;
    setZoomLevel: (value: number) => void;
}) {
    const initialImage = React.useRef({imgURL, occlusionElements});
    React.useEffect(() => {
        if (!open) return;
        let isMounted = true;
        const canvas = new fabric.Canvas(canvasRef.current, {stateful: true});
        fabricRef.current = canvas;
        const {imgURL, occlusionElements} = initialImage.current;
        const initFabric = async () => {
            canvas.selection = false;
            canvas.uniformScaling = false;
            imgEl.setAttribute("crossOrigin", "anonymous");
            if (isWebURL_REGEXP.test(imgURL)) imgEl.src = imgURL;
            else imgEl.src = await WindowParentBridge.makeAssetUrl(imgURL);
            imgEl.onload = () => {
                if (!isMounted) return;
                const img = new fabric.Image(imgEl);
                const appRoot = WindowBridge.getElementById("app");
                const canvasWidth = Math.min(imgEl.width, appRoot?.clientWidth - 160 || 800);
                const canvasHeight = Math.min(
                    imgEl.height,
                    WindowBridge.getBody().clientHeight - 340
                );
                const scale = Number(
                    Math.min(canvasWidth / imgEl.width, canvasHeight / imgEl.height).toPrecision(1)
                );
                imageDimensions.current = {width: imgEl.width, height: imgEl.height};
                setZoomLevel(Math.round(scale * 100));
                canvas.setZoom(scale);
                canvas.setWidth(imgEl.width * scale);
                canvas.setHeight(imgEl.height * scale);
                canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                    scaleX: 1,
                    scaleY: 1
                });
                canvas.selection = true;
                canvas.renderAll();
                occlusionElements.forEach((obj) => {
                    canvas.add(
                        createOcclusionRectEl(
                            fabric,
                            obj.left,
                            obj.top,
                            obj.width,
                            obj.height,
                            obj.angle,
                            obj.cId,
                            obj.hint
                        )
                    );
                });
                canvas.renderAll();
            };
        };
        void initFabric();
        return () => {
            isMounted = false;
            imgEl.onload = null;
            canvas.dispose();
            fabricRef.current = null;
        };
    }, [open, canvasRef, fabricRef, imgEl, imageDimensions, setZoomLevel]);
}
