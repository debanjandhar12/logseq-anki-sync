/***
* This files contains the js for the front side of anki cards. 
*/
import {fabric} from 'fabric';
import {createOcclusionRectEl} from "../ui/OcclusionEditor";

window.onload = function () {
    if (type == "image_occlusion") {
        // Get current cloze id (only works for image occlusion)
        let currentClozeId = '-1';
        for(let i = 1; i <= 9; i++)
            if (document.getElementById(`c${i}`)) currentClozeId = `${i}`;
        console.log(`Current cloze id: ${currentClozeId}`);
        if(currentClozeId == '-1') return;

        // Replace all images with canvas
        let imgToCanvasHashMap = {};
        let images = document.getElementsByTagName("img");
        for (let image of images) {
            let canvasEl = document.createElement("canvas");
            canvasEl.width = image.width;
            canvasEl.height = image.height;
            let canvas = new fabric.Canvas(canvasEl, {imageSmoothingEnabled: false});
            let imgEl = new Image();
            imgEl.src = image.src;
            imgEl.onload = function() {
                let imgFabric = new fabric.Image(imgEl);
                let zoom = Math.max( canvas.width / imgFabric.width, canvas.height / imgFabric.height );
                canvas.setZoom(zoom);
                canvas.setBackgroundImage(imgFabric, canvas.renderAll.bind(canvas), {
                    scaleX: 1,
                    scaleY: 1
                });
                canvas.renderAll();
            }
            canvasEl.style.position = "relative";
            image.replaceWith(canvasEl);
            let imgPath = decodeURIComponent(image.src.replace(/^.*[\\\/]/, ''));
            if(imgToCanvasHashMap[imgPath] == null) imgToCanvasHashMap[imgPath] = [];
            imgToCanvasHashMap[imgPath].push(canvas);
        }

        // Iterate the imgToOcclusionArrHashMap to draw the occlusion
        let imgToOcclusionArrHashMap = JSON.parse(document.getElementById("imgToOcclusionArrHashMap").innerHTML);
        for (let image in imgToOcclusionArrHashMap) {
            let occlusionArr = imgToOcclusionArrHashMap[image];
            occlusionArr.forEach((obj) => {
                if(obj.cId == currentClozeId) {
                    imgToCanvasHashMap[encodeURIComponent(image)].forEach((canvas) => {
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