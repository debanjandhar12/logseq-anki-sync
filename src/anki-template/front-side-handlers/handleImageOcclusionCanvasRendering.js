import {fabric} from "fabric";
import path from "path-browserify";
import {createOcclusionRectEl} from "../../utils/occlusionUtils";

export function handleImageOcclusionCanvasRendering() {
    if (window.type !== "image_occlusion") return;

    // Get current cloze id (only works for image occlusion)
    let currentClozeId = "-1";
    for (let i = 1; i <= 9; i++) if (document.getElementById(`c${i}`)) currentClozeId = `${i}`;
    if (currentClozeId === "-1") return;
    if (!document.getElementById("localImgBasePath")) return;
    // Get localImgBasePath
    let localImgBasePath = document.getElementById("localImgBasePath").src;
    localImgBasePath = localImgBasePath.substring(0, localImgBasePath.lastIndexOf("/"));
    // Replace all images with canvas
    const imgToCanvasListHashMap = {};
    const canvasesToDispose = [];
    const pendingImages = [];
    const images = Array.from(document.getElementsByTagName("img"));
    for (const image of images) {
        image.style.visibility = "hidden";
        const canvasEl = document.createElement("canvas");
        canvasEl.width = image.width;
        canvasEl.height = image.height;
        const canvas = new fabric.StaticCanvas(canvasEl, {
            imageSmoothingEnabled: false
        });
        canvasesToDispose.push(canvas);
        const imgEl = new Image();
        pendingImages.push(imgEl);
        imgEl.onload = () => {
            canvas.setDimensions({
                width: canvas.width || imgEl.naturalWidth,
                height: canvas.height || imgEl.naturalHeight
            });
            const imgFabric = new fabric.Image(imgEl);
            const scaleX = canvas.width / imgFabric.width,
                scaleY = canvas.height / imgFabric.height;
            canvas.setViewportTransform([scaleX, 0, 0, scaleY, 0, 0]);
            canvas.setBackgroundImage(imgFabric, canvas.renderAll.bind(canvas), {
                scaleX: 1,
                scaleY: 1
            });
        };
        imgEl.src = image.src;
        canvasEl.style.position = "relative";
        image.replaceWith(canvasEl);
        if (imgToCanvasListHashMap[image.src] == null) imgToCanvasListHashMap[image.src] = [];
        imgToCanvasListHashMap[image.src].push(canvas);
    }

    // Show the main content (without images)
    document.getElementById("main-content").style.visibility = "visible";

    // Iterate the images in imgToOcclusionDataHashMap and inject the canvas into dom instead of images
    const imgToOcclusionDataHashMap = JSON.parse(
        document.getElementById("imgToOcclusionDataHashMap").innerHTML
    );

    // Check for hide-all-test-one tag
    let hideAllTestOne = false;
    const tagsEl = document.getElementById("tags");
    if (tagsEl) {
        hideAllTestOne = tagsEl.getAttribute("tags_name").split(" ").includes("hide-all-test-one");
    }

    for (const image in imgToOcclusionDataHashMap) {
        const occlusionElements = imgToOcclusionDataHashMap[image].elements;
        occlusionElements.forEach((occlusionElem) => {
            const canvasList =
                imgToCanvasListHashMap[localImgBasePath + "/" + path.basename(image)] ||
                imgToCanvasListHashMap[encodeURI(localImgBasePath + "/" + path.basename(image))] ||
                imgToCanvasListHashMap[image] ||
                imgToCanvasListHashMap[encodeURI(image)] ||
                [];
            if (String(occlusionElem.cId) === String(currentClozeId)) {
                canvasList.forEach((canvas) => {
                    const occlusion = createOcclusionRectEl(
                        fabric,
                        occlusionElem.left,
                        occlusionElem.top,
                        occlusionElem.width,
                        occlusionElem.height,
                        occlusionElem.angle,
                        occlusionElem.cId,
                        occlusionElem.hint
                    );
                    occlusion._objects[0].set("opacity", 1);
                    canvas.add(occlusion);
                    canvas.renderAll();
                });
            } else if (occlusionElem.cId !== currentClozeId && hideAllTestOne) {
                canvasList.forEach((canvas) => {
                    const occlusion = createOcclusionRectEl(
                        fabric,
                        occlusionElem.left,
                        occlusionElem.top,
                        occlusionElem.width,
                        occlusionElem.height,
                        occlusionElem.angle,
                        occlusionElem.cId,
                        null // do not display hint for other clozes
                    );
                    occlusion._objects[0].set("opacity", 1);
                    occlusion._objects[0].set("fill", "#3b4042");
                    occlusion._objects[0].set("stroke", "#2a3942");
                    occlusion._objects[1].set("opacity", 0);
                    canvas.add(occlusion);
                    canvas.renderAll();
                });
            }
        });
    }
    // Change the style of canvas
    const canvases = Array.from(document.getElementsByTagName("canvas"));
    for (const canvasEl of canvases) {
        if (!canvasEl.classList.contains("lower-canvas")) continue;
        canvasEl.style["user-select"] = "inherit";
        canvasEl.style["touch-action"] = "inherit";
    }
    return () => {
        for (const image of pendingImages) image.onload = null;
        for (const canvas of canvasesToDispose) canvas.dispose();
    };
}
