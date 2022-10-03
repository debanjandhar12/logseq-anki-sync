import fabric from 'bundle-text:../../node_modules/fabric/dist/fabric.min.js';
import path from "path";

export async function OcclusionEditor(img: string, existingOcclusion: string): Promise<string | boolean> {
    return new Promise(async function (resolve, reject) {
        const editor = window.parent.document.createElement('div');
        editor.innerHTML = `
            <div class="occlusion-editor-toolbar">
               <button onclick="addOcclusion()">+</button>
               <button id="delete-occlusion-btn" onclick="deleteOcclusion(this)" disabled>-</button>
               <select id="select-cid-value" class="mt-1 block text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 sm:text-sm sm:leading-5 ml-1 sm:ml-4 w-12 sm:w-20 form-select" style="display: inline-block;margin: 0;" disabled><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select>
            </div>
            <div class="cloze-editor-image">
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
                     <div class="sm:flex sm:items-start">
                        <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                           <h2 class="headline text-lg leading-6 font-medium">
                            Cloze Editor
                            <div id="cloze-editor"></div>
                            </h2>
                           <label class="sublabel">
                              <h3 class="subline text-gray-400"></h3>
                           </label>
                        </div>
                     </div>
                     <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse"><span class="flex w-full rounded-md shadow-sm sm:ml-3 sm:w-auto"><button type="button" class="inline-flex justify-center w-full rounded-md border border-transparent px-4 py-2 bg-indigo-600 text-base leading-6 font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 focus:shadow-outline-indigo transition ease-in-out duration-150 sm:text-sm sm:leading-5" onclick="sync_save_action()">Save</button></span><span class="mt-3 flex w-full rounded-md shadow-sm sm:mt-0 sm:w-auto"><button type="button" class="inline-flex justify-center w-full rounded-md border border-gray-300 px-4 py-2 bg-white text-base leading-6 font-medium text-gray-700 shadow-sm hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue transition ease-in-out duration-150 sm:text-sm sm:leading-5" onclick="occlusion_cancel_action()">Cancel</button></span></div>
                  </div>
               </div>
            </div>
         </div>`;
        let canvasEl = window.parent.document.createElement('canvas');
        editor.querySelector('.cloze-editor-image').appendChild(canvasEl);
        div.querySelector('#cloze-editor').appendChild(editor);
        window.parent.document.body.appendChild(div);
        let fabricScript = window.parent.document.createElement('script');
        fabricScript.innerHTML = fabric;
        window.parent.document.body.appendChild(fabricScript);
        let canvas = new window.parent.fabric.Canvas(canvasEl, {imageSmoothingEnabled: false});
        canvas.selection = false; // disable group selection
        canvas.uniformScaling = false; // disable object scaling keeping aspect ratio
        let scale : number = 1;

        // Load the image as background
        let imgEl = new Image();
        imgEl.setAttribute('crossOrigin', 'anonymous');
        const graphPath = (await logseq.App.getCurrentGraph()).path;
        imgEl.src = encodeURI(path.join(graphPath, path.resolve(img)));
        imgEl.onload = function () {
            let img = new window.parent.fabric.Image(imgEl);
            let canvasWidth = Math.min(imgEl.width,  window.parent.document.querySelector('.occlusion__editor').clientWidth - 160);
            let canvasHeight = Math.min(imgEl.height, window.parent.document.body.clientHeight - 300);
            scale = Number(Math.min(canvasWidth / imgEl.width, canvasHeight / imgEl.height).toPrecision(1));
            canvas.setZoom(scale);
            canvas.setWidth(imgEl.width * scale);
            canvas.setHeight(imgEl.height * scale);
            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                scaleX: 1,
                scaleY: 1
            });
            canvas.renderAll();

            if(existingOcclusion) {
                let occlusionArr = JSON.parse(Buffer.from(existingOcclusion, 'base64').toString());
                console.log(occlusionArr);
                occlusionArr.forEach((o) => {
                    let occlusion = createOcclusionRectEl(o.left, o.top, o.width, o.height, o.angle, o.cId);
                    canvas.add(occlusion);
                });
                canvas.renderAll();
            }
        }
        // Keep objects within canvas https://groups.google.com/g/fabricjs/c/lHf0qadUOY8?pli=1
        canvas.on('object:modified', function (e) {
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
            let cid = e.target.value;
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
        canvas.on('selection:cleared', function () {
            window.parent.document.getElementById('delete-occlusion-btn').disabled = true;
            window.parent.document.getElementById('select-cid-value').disabled = true;
            window.parent.document.getElementById('select-cid-value').value = '';
        });

        // @ts-ignore
        window.parent.addOcclusion = () => {
            let randomLocation = {
                x: Math.floor(Math.random() * (canvas.width - 100)),
                y: Math.floor(Math.random() * (canvas.height - 100))
            }
            let occlusionEl = createOcclusionRectEl(randomLocation.x, randomLocation.y);
            canvas.add(occlusionEl);
            canvas.renderAll();
        }
        window.parent.deleteOcclusion = (e) => {
            canvas.remove(canvas.getActiveObject());
            canvas.renderAll();
        }
        // @ts-ignore
        window.parent.sync_save_action = () => {
            // Iterate over all objects and save them
            let occlusions = [];
            canvas.getObjects().forEach((obj) => {
                occlusions.push({
                    left: obj.left,
                    top: obj.top,
                    width: obj.getScaledWidth(),
                    height: obj.getScaledHeight(),
                    angle: obj.angle,
                    cId: parseInt(obj._objects[1].text)
                });
            });
            console.log("save occlusions",occlusions);
            resolve(Buffer.from(JSON.stringify(occlusions), 'utf8').toString('base64'));
            window.parent.document.body.removeChild(div);
        }
        // @ts-ignore
        window.parent.occlusion_cancel_action = () => {
            resolve(false);
            window.parent.document.body.removeChild(div);
        }
    });
}

function createOcclusionRectEl(left = 0, top = 0, width = 80, height = 40, angle = 0, cId = 1) {
    let rect = new window.parent.fabric.Rect({
        fill: '#FFEBA2',
        stroke: '#000',
        strokeWidth: 1,
        strokeUniform: true,
        noScaleCache: false,
        opacity: 0.7,
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