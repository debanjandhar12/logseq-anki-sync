import path from "path";
import fs from "fs";
import {ANKI_ICON, isWebURL_REGEXP} from "../constants";

declare global {
    interface Window { fabric: any; }
}

const fabric = fs.readFileSync(__dirname + '/../../node_modules/fabric/dist/fabric.min.js', 'utf8');
if(!window.parent.fabric) {
    let fabricScript = window.parent.document.createElement('script');
    fabricScript.innerHTML = fabric;
    window.parent.document.body.appendChild(fabricScript);
}

export async function OcclusionEditor(img: string, occlusionArr: Array<any>): Promise<Array<any> | boolean> {
    return new Promise(async function (resolve, reject) {
        const editor = window.parent.document.createElement('div');
        editor.innerHTML = `
            <div class="flex" style="justify-content: space-between;margin-top: 0.3rem; margin-bottom: 0.3rem;">
                <div class="flex" style="align-items: center;">
                    <i class="ti">${ANKI_ICON}</i><h3 class="text-lg">Occlusion Editor</h3>
                </div>
                <a href="https://www.buymeacoffee.com/debanjandhar12"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-orange.png" style="height: 1.8rem;"></img></a>
            </div>
            <div class="occlusion-editor-toolbar flex" style="align-items: center; justify-content: end;">
               <button onclick="addOcclusion()" class="ui__button bg-indigo-600 hover:bg-indigo-700 focus:border-indigo-700 active:bg-indigo-700 text-center text-sm" style="margin: 0.125rem 0.25rem 0.125rem 0; padding: .35rem .35rem;"><i class="ti ti-plus" style="font-size: 1.25rem"></i></button>
               <button id="delete-occlusion-btn" onclick="deleteOcclusion(this)" disabled class="ui__button bg-indigo-600 hover:bg-indigo-700 focus:border-indigo-700 active:bg-indigo-700 text-center text-sm" style="margin: 0.125rem 0.25rem 0.125rem 0; padding: .35rem .35rem;"><i class="ti ti-trash" style="font-size: 1.25rem"></i></button>
               <span style="font-size:0.875rem;margin-left: 1rem;">Cloze Id:</span> <select id="select-cid-value" class="form-select is-small" style="margin: 0;width:80px;height: 2.2rem;" disabled><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select>
            </div>
            <div class="cloze-editor-image flex" style="justify-content: center;">
            </div>
        `;
        const div = window.parent.document.createElement('div');
        div.innerHTML = `
            <div class="ui__modal occlusion__editor settings-modal cp__settings-main" style="z-index: 9999;">
            <div class="ui__modal-overlay ease-out duration-300 opacity-100 enter-done">
               <div class="absolute inset-0 opacity-75"></div>
            </div>
            <div class="ui__modal-panel transform transition-all sm:min-w-lg sm ease-out duration-300 opacity-100 translate-y-0 sm:scale-100 enter-done">
               <div class="absolute top-0 right-0 pt-2 pr-2">
                  <a aria-label="Close" type="button" class="ui__modal-close opacity-60 hover:opacity-100" onclick="occlusion_cancel_action()">
                     <svg stroke="currentColor" viewBox="0 0 24 24" fill="none" class="h-6 w-6">
                        <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
                     </svg>
                  </a>
               </div>
               <div class="panel-content">
                  <div class="ui__confirm-modal is-">
                     <div id="cloze-editor"></div>
                     <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse"><span class="flex w-full rounded-md shadow-sm sm:ml-3 sm:w-auto"><button type="button" class="inline-flex justify-center w-full rounded-md border border-transparent px-4 py-2 bg-indigo-600 text-base leading-6 font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 focus:shadow-outline-indigo transition ease-in-out duration-150 sm:text-sm sm:leading-5" onclick="occlusion_save_action()">Save</button></span><span class="mt-3 flex w-full rounded-md shadow-sm sm:mt-0 sm:w-auto"><button type="button" class="inline-flex justify-center w-full rounded-md border border-gray-300 px-4 py-2 bg-white text-base leading-6 font-medium text-gray-700 shadow-sm hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue transition ease-in-out duration-150 sm:text-sm sm:leading-5" onclick="occlusion_cancel_action()">Cancel</button></span></div>
                  </div>
               </div>
            </div>
         </div>`;
        // -Inject the editor into the DOM-
        let canvasEl = window.parent.document.createElement('canvas');
        editor.querySelector('.cloze-editor-image').appendChild(canvasEl);
        div.querySelector('#cloze-editor').appendChild(editor);
        window.parent.document.body.appendChild(div);
        let canvas = new window.parent.fabric.Canvas(canvasEl, {imageSmoothingEnabled: false});
        canvas.selection = false; // disable group selection
        canvas.uniformScaling = false; // disable object scaling keeping aspect ratio

        // Load the image as background and add existing occulusion
        let imgEl = new Image();
        imgEl.setAttribute('crossOrigin', 'anonymous');
        const graphPath = (await logseq.App.getCurrentGraph()).path;
        imgEl.src = isWebURL_REGEXP.test(img) ? img : encodeURI(path.join(graphPath, path.resolve(img)));
        imgEl.onload = function () {
            let img = new window.parent.fabric.Image(imgEl);
            let canvasWidth = Math.min(imgEl.width,  window.parent.document.querySelector('.occlusion__editor').clientWidth - 160);
            let canvasHeight = Math.min(imgEl.height, window.parent.document.body.clientHeight - 340);
            let scale = Number(Math.min(canvasWidth / imgEl.width, canvasHeight / imgEl.height).toPrecision(1));
            canvas.setZoom(scale);
            canvas.setWidth(imgEl.width * scale);
            canvas.setHeight(imgEl.height * scale);
            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                scaleX: 1,
                scaleY: 1
            });
            canvas.renderAll();

            occlusionArr.forEach((obj) => {
                let occlusionEl = createOcclusionRectEl(obj.left, obj.top, obj.width, obj.height, obj.angle, obj.cId);
                canvas.add(occlusionEl);
            });
            canvas.renderAll();
        }

        // -Fabric.js Event listeners-
        canvas.on('object:modified', function (e) { // Keep objects within canvas https://groups.google.com/g/fabricjs/c/lHf0qadUOY8?pli=1
            let obj = e.target;
            if (obj.currentHeight > obj.canvas.height || obj.currentWidth > obj.canvas.width) {
                return;
            }
            obj.setCoords();
            if (obj.getBoundingRect().top < 0 || obj.getBoundingRect().left < 0) {
                obj.top = Math.max(obj.top, obj.top - obj.getBoundingRect().top);
                obj.left = Math.max(obj.left, obj.left - obj.getBoundingRect().left);
            }
            if (obj.getBoundingRect().top + obj.getBoundingRect().height > obj.canvas.height || obj.getBoundingRect().left + obj.getBoundingRect().width > obj.canvas.width) {
                obj.top = Math.min(obj.top, obj.canvas.height - obj.getBoundingRect().height + obj.top - obj.getBoundingRect().top);
                obj.left = Math.min(obj.left, obj.canvas.width - obj.getBoundingRect().width + obj.left - obj.getBoundingRect().left);
            }
        });
        window.parent.document.getElementById('select-cid-value').onchange = function (e) {
            let cid = (e.target as HTMLInputElement).value;
            let activeObject = canvas.getActiveObject();
            if (activeObject) {
                canvas.getActiveObject()._objects[1].set('text',cid);
                canvas.renderAll();
                canvas.focus();
            }
        }
        // Handle Updating UI depending on selection
        window.parent.document.getElementById('select-cid-value').value = '';
        canvas.on('selection:created', function () {
            window.parent.document.getElementById('delete-occlusion-btn').disabled = false;
            window.parent.document.getElementById('select-cid-value').disabled = false;
            window.parent.document.getElementById('select-cid-value').value = canvas.getActiveObject()._objects[1].text;
        });
        canvas.on('selection:updated', function () {
            window.parent.document.getElementById('delete-occlusion-btn').disabled = false;
            window.parent.document.getElementById('select-cid-value').disabled = false;
            window.parent.document.getElementById('select-cid-value').value = canvas.getActiveObject()._objects[1].text;
        });
        canvas.on('selection:cleared', function () {
            window.parent.document.getElementById('delete-occlusion-btn').disabled = true;
            window.parent.document.getElementById('select-cid-value').disabled = true;
            window.parent.document.getElementById('select-cid-value').value = '';
        });

        // -Buttons Event Listeners-
        // @ts-ignore
        window.parent.addOcclusion = () => {
            let randomLocation = {
                x: Math.floor(Math.random() * (imgEl.width - 0.22 * imgEl.width)) + 0.11 * imgEl.width,
                y: Math.floor(Math.random() * (imgEl.height - 0.22 * imgEl.height)) + 0.11 * imgEl.height
            }
            let occlusionEl = createOcclusionRectEl(randomLocation.x, randomLocation.y, 0.22 * imgEl.width, 0.22 * imgEl.height);
            canvas.add(occlusionEl);
            canvas.renderAll();
        }
        // @ts-ignore
        window.parent.deleteOcclusion = (e) => {
            canvas.remove(canvas.getActiveObject());
            canvas.renderAll();
        }
        // @ts-ignore
        window.parent.occlusion_save_action = () => {
            // Iterate over all objects and save them
            let occlusionArr = [];
            canvas.getObjects().forEach((obj) => {
                occlusionArr.push({
                    left: obj.left,
                    top: obj.top,
                    width: obj.getScaledWidth(),
                    height: obj.getScaledHeight(),
                    angle: obj.angle,
                    cId: parseInt(obj._objects[1].text)
                });
            });
            resolve(occlusionArr);
            window.parent.document.body.removeChild(div);
        }
        // @ts-ignore
        window.parent.occlusion_cancel_action = () => {
            resolve(false);
            window.parent.document.body.removeChild(div);
        }
    });
}

export function createOcclusionRectEl(left = 0, top = 0, width = 80, height = 40, angle = 0, cId = 1) {
    let rect = new window.parent.fabric.Rect({
        fill: '#FFEBA2',
        stroke: '#000',
        strokeWidth: 1,
        strokeUniform: true,
        noScaleCache: false,
        opacity: 0.8,
        width: width,
        height: height,
        originX: 'center',
        originY: 'center'
    });
    let text = new window.parent.fabric.Text(`${cId}`, {
        originX: 'center',
        originY: 'center'
    });
    text.scaleToHeight(height);
    let group = new window.parent.fabric.Group([ rect, text ], {
        left: left,
        top: top,
        width: width,
        height: height,
        originX: 'center',
        originY: 'center',
        angle: angle
    });
    return group;
}