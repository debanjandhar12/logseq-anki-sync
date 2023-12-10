/***
 * This files contains the js for the front side of anki cards.
 */
import {fabric} from "fabric";
import {createOcclusionRectEl} from "../ui/customized/OcclusionEditor";
import path from "path-browserify";

const onLoadHandler = () => {
    if (window.type == "image_occlusion") {
        // Get current cloze id (only works for image occlusion)
        let currentClozeId = "-1";
        for (let i = 1; i <= 9; i++)
            if (document.getElementById(`c${i}`)) currentClozeId = `${i}`;
        console.log(`Current cloze id: ${currentClozeId}`);
        if (currentClozeId == "-1") return;
        if (!document.getElementById("localImgBasePath")) return;
        // Get localImgBasePath
        let localImgBasePath = document.getElementById("localImgBasePath").src;
        localImgBasePath = localImgBasePath.substring(0, localImgBasePath.lastIndexOf("/"));
        // Replace all images with canvas
        let imgToCanvasListHashMap = {};
        let images = Array.from(document.getElementsByTagName("img"));
        for (let image of images) {
            image.style.visibility = "hidden";
            let canvasEl = document.createElement("canvas");
            canvasEl.width = image.width;
            canvasEl.height = image.height;
            let canvas = new fabric.Canvas(canvasEl, {
                imageSmoothingEnabled: false,
            });
            let imgEl = new Image();
            imgEl.src = image.src;
            imgEl.onload = function () {
                let imgFabric = new fabric.Image(imgEl);
                let scaleX = canvas.width / imgFabric.width,
                    scaleY = canvas.height / imgFabric.height;
                canvas.setViewportTransform([scaleX, 0, 0, scaleY, 0, 0]);
                canvas.setBackgroundImage(imgFabric, canvas.renderAll.bind(canvas), {
                    scaleX: 1,
                    scaleY: 1,
                });
            };
            canvasEl.style.position = "relative";
            image.replaceWith(canvasEl);
            if (imgToCanvasListHashMap[image.src] == null)
                imgToCanvasListHashMap[image.src] = [];
            imgToCanvasListHashMap[image.src].push(canvas);
        }

        // Show the main content (without images)
        document.getElementById("main-content").style.visibility = "visible";

        // Iterate the images in imgToOcclusionDataHashMap and inject the canvas into dom instead of images
        let imgToOcclusionDataHashMap = JSON.parse(
            document.getElementById("imgToOcclusionDataHashMap").innerHTML,
        );
        for (let image in imgToOcclusionDataHashMap) {
            let occlusionElements = imgToOcclusionDataHashMap[image].elements;
            let occlusionConfig = imgToOcclusionDataHashMap[image].config;
            console.log(occlusionConfig);
            occlusionElements.forEach((occlusionElem) => {
                let canvasList =
                    imgToCanvasListHashMap[localImgBasePath + "/" + path.basename(image)] ||
                    imgToCanvasListHashMap[
                        encodeURI(localImgBasePath + "/" + path.basename(image))
                    ] ||
                    imgToCanvasListHashMap[image] ||
                    imgToCanvasListHashMap[encodeURI(image)] ||
                    [];
                if (occlusionElem.cId == currentClozeId) {
                    canvasList.forEach((canvas) => {
                        let occlusion = createOcclusionRectEl(
                            occlusionElem.left,
                            occlusionElem.top,
                            occlusionElem.width,
                            occlusionElem.height,
                            occlusionElem.angle,
                            occlusionElem.cId,
                        );
                        occlusion._objects[0].set("opacity", 1);
                        canvas.add(occlusion);
                        canvas.renderAll();
                    });
                } else if (
                    occlusionElem.cId != currentClozeId &&
                    occlusionConfig.hideAllTestOne == true
                ) {
                    canvasList.forEach((canvas) => {
                        let occlusion = createOcclusionRectEl(
                            occlusionElem.left,
                            occlusionElem.top,
                            occlusionElem.width,
                            occlusionElem.height,
                            occlusionElem.angle,
                            occlusionElem.cId,
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
    }
};

if (document.readyState === "complete") {
    onLoadHandler();
} else {
    window.addEventListener("load", onLoadHandler);
}
