/***
* This files contains the js for the front side of anki cards. 
*/
import {fabric} from 'fabric';
import {createOcclusionRectEl} from "../ui/OcclusionEditor";

window.onload = () => {
    if (type == "image_occlusion") {
        // Get current cloze id (only works for image occlusion)
        let currentClozeId = '-1';
        for(let i = 1; i <= 9; i++)
            if (document.getElementById(`c${i}`)) currentClozeId = `${i}`;
        console.log(`Current cloze id: ${currentClozeId}`);
        if(currentClozeId == '-1') return;
        // Get localImgBasePath
        let localImgBasePath = document.getElementById("localImgBasePath").src;
        localImgBasePath = localImgBasePath.substring(0, localImgBasePath.lastIndexOf("/"));
        // Replace all images with canvas
        let imgToCanvasHashMap = {};
        let images = Array.from(document.getElementsByTagName("img"));
        for (let image of images) {
            image.style.visibility= 'hidden';
            let canvasEl = document.createElement("canvas");
            canvasEl.width = image.width;
            canvasEl.height = image.height;
            let canvas = new fabric.Canvas(canvasEl, {imageSmoothingEnabled: false});
            let imgEl = new Image();
            imgEl.src = image.src;
            imgEl.onload = function() {
                let imgFabric = new fabric.Image(imgEl);
                let scaleX = canvas.width / imgFabric.width,  scaleY = canvas.height / imgFabric.height;
                canvas.setViewportTransform([scaleX, 0, 0, scaleY, 0, 0]);
                canvas.setBackgroundImage(imgFabric, canvas.renderAll.bind(canvas), {
                    scaleX: 1,
                    scaleY: 1
                });
            }
            canvasEl.style.position = "relative";
            image.replaceWith(canvasEl);
            if(imgToCanvasHashMap[image.src] == null) imgToCanvasHashMap[image.src] = [];
            imgToCanvasHashMap[image.src].push(canvas);
        }

        // Iterate the imgToOcclusionArrHashMap to draw the occlusion
        let imgToOcclusionArrHashMap = JSON.parse(document.getElementById("imgToOcclusionArrHashMap").innerHTML);
        for (let image in imgToOcclusionArrHashMap) {
            let occlusionArr = imgToOcclusionArrHashMap[image];
            occlusionArr.forEach((obj) => {
                if(obj.cId == currentClozeId) {
                    (imgToCanvasHashMap[localImgBasePath + '/' + encodeURIComponent(encodeURIComponent(image))] || imgToCanvasHashMap[decodeURIComponent(image)]).forEach((canvas) => {
                        let occlusion = createOcclusionRectEl(obj.left, obj.top, obj.width, obj.height, obj.angle, obj.cId);
                        occlusion._objects[0].set('opacity', 1);
                        canvas.add(occlusion);
                        canvas.renderAll();
                    });
                }
            });
        }
    }
}