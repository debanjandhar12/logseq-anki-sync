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
        let canvasHashMap = {};
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
            if(canvasHashMap[imgPath] == null) canvasHashMap[imgPath] = [];
            canvasHashMap[imgPath].push(canvas);
        }
        // Iterate the occlusionHashMap to draw the occlusion
        let occlusionDataHashMap = JSON.parse(document.getElementById("occlusionDataHashMap").innerHTML);
        console.log(occlusionDataHashMap, canvasHashMap);
        for (let image in occlusionDataHashMap) {
            let occlusionArr = occlusionDataHashMap[image];
            occlusionArr.forEach((o) => {
                if(o.cId == currentClozeId) {
                    canvasHashMap[encodeURIComponent(image)].forEach((canvas) => {
                        let occlusion = createOcclusionRectEl(o.left, o.top, o.width, o.height, o.angle, o.cId);
                        occlusion._objects[0].set('opacity', 1);
                        canvas.add(occlusion);
                        canvas.renderAll();
                    });
                }
            });
        }
    }
}