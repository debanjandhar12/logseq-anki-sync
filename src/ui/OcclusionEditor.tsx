import {ADD_OCCLUSION_ICON, ANKI_ICON, DONATE_ICON, isWebURL_REGEXP, REMOVE_OCCLUSION_ICON} from "../constants";
import React, { useState } from "react";
import ReactDOM from "react-dom";
import _ from "lodash";
import fabric from "../../node_modules/fabric/dist/fabric.js?string";
import path from "path-browserify";

if (!window.parent.fabric) {
    const fabricScript = window.parent.document.createElement("script");
    fabricScript.innerHTML = fabric;
    window.parent.document.body.appendChild(fabricScript);
}

export async function OcclusionEditor(
    imgURL: string,
    occlusionArr: Array<any>,
): Promise<Array<any> | boolean> {
    return new Promise(async function (resolve, reject) {
        const div = window.parent.document.createElement("div");
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
                     <div class="cloze-editor"></div>
                     <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse"><span class="flex w-full rounded-md shadow-sm sm:ml-3 sm:w-auto"><button type="button" class="inline-flex justify-center w-full rounded-md border border-transparent px-4 py-2 bg-indigo-600 text-base leading-6 font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 focus:shadow-outline-indigo transition ease-in-out duration-150 sm:text-sm sm:leading-5" onclick="occlusion_save_action()">Save</button></span><span class="mt-3 flex w-full rounded-md shadow-sm sm:mt-0 sm:w-auto"><button type="button" class="inline-flex justify-center w-full rounded-md border border-gray-300 px-4 py-2 bg-white text-base leading-6 font-medium text-gray-700 shadow-sm hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue transition ease-in-out duration-150 sm:text-sm sm:leading-5" onclick="occlusion_cancel_action()">Cancel</button></span></div>
                  </div>
               </div>
            </div>
         </div>`;
        const fabricRef = React.createRef<any>();
        const clozeEditorContainer =
            div.getElementsByClassName("cloze-editor")[0];
        try {
            window.parent.document.body.appendChild(div);
            ReactDOM.render(
                <OcclusionEditorComponent
                    imgURL={imgURL}
                    occlusionArr={occlusionArr}
                    ref={fabricRef}
                />,
                clozeEditorContainer,
            );
        } catch (e) {
            // @ts-ignore
            window.parent.occlusion_cancel_action();
            logseq.App.showMsg(
                "Failed to mount OcclusionEditor! Error Message: " + e,
            );
            console.error(e);
        }

        const onKeydown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                // @ts-ignore
                window.parent.occlusion_cancel_action();
            } else if (e.key === "Enter") {
                // @ts-ignore
                window.parent.occlusion_save_action();
            } else if (e.key === "s" && e.ctrlKey) {
                // @ts-ignore
                window.parent.occlusion_save_action();
            }
        };
        window.parent.document.addEventListener("keydown", onKeydown);
        // @ts-ignore
        window.parent.occlusion_save_action = () => {
            // Iterate over all objects and save them
            const occlusionArr = [];
            fabricRef.current.getObjects().forEach((obj) => {
                occlusionArr.push({
                    left: obj.left,
                    top: obj.top,
                    width: obj.getScaledWidth(),
                    height: obj.getScaledHeight(),
                    angle: obj.angle,
                    cId: parseInt(obj._objects[1].text),
                });
            });
            ReactDOM.unmountComponentAtNode(div);
            window.parent.document.body.removeChild(div);
            window.parent.document.removeEventListener("keydown", onKeydown);
            resolve(occlusionArr);
        };
        // @ts-ignore
        window.parent.occlusion_cancel_action = () => {
            ReactDOM.unmountComponentAtNode(div);
            window.parent.document.body.removeChild(div);
            window.parent.document.removeEventListener("keydown", onKeydown);
            resolve(false);
        };
    });
}

const OcclusionEditorComponent = React.forwardRef<any, any>(
    ({ imgURL, occlusionArr }, fabricRef: any) => {
        const canvasRef = React.useRef(null);
        const cidSelectorRef = React.useRef(null);
        const [imgEl, setImgEl] = React.useState(new window.parent.Image());

        React.useEffect(() => {
            const initFabric = async () => {
                fabricRef.current = new window.parent.fabric.Canvas(
                    canvasRef.current,
                    { stateful: true },
                );
                fabricRef.current.selection = false; // disable group selection
                fabricRef.current.uniformScaling = false; // disable object scaling keeping aspect ratio

                // Load the image and then add the occlusion rectangles
                imgEl.setAttribute("crossOrigin", "anonymous");
                const graphPath = (await logseq.App.getCurrentGraph()).path;
                imgEl.src = isWebURL_REGEXP.test(imgURL)
                    ? imgURL
                    : encodeURI(path.join(graphPath, path.resolve(imgURL)));
                imgEl.onload = function () {
                    const img = new window.parent.fabric.Image(imgEl);
                    const canvasWidth = Math.min(
                        imgEl.width,
                        window.parent.document.querySelector(
                            ".occlusion__editor",
                        ).clientWidth - 160,
                    );
                    const canvasHeight = Math.min(
                        imgEl.height,
                        window.parent.document.body.clientHeight - 340,
                    );
                    const scale = Number(
                        Math.min(
                            canvasWidth / imgEl.width,
                            canvasHeight / imgEl.height,
                        ).toPrecision(1),
                    );
                    fabricRef.current.setZoom(scale);
                    fabricRef.current.setWidth(imgEl.width * scale);
                    fabricRef.current.setHeight(imgEl.height * scale);
                    fabricRef.current.setBackgroundImage(
                        img,
                        fabricRef.current.renderAll.bind(fabricRef.current),
                        {
                            scaleX: 1,
                            scaleY: 1,
                        },
                    );
                    fabricRef.current.renderAll();

                    occlusionArr.forEach((obj) => {
                        const occlusionEl = createOcclusionRectEl(
                            obj.left,
                            obj.top,
                            obj.width,
                            obj.height,
                            obj.angle,
                            obj.cId,
                        );
                        fabricRef.current.add(occlusionEl);
                    });
                    fabricRef.current.renderAll();
                };
            };
            const disposeFabric = () => {
                fabricRef.current.dispose();
            };
            initFabric();
            return () => {
                disposeFabric();
            };
        }, []);

        // Handle Selection
        const [fabricSelection, setFabricSelection] = React.useState(null);
        React.useEffect(() => {
            fabricRef.current.on("selection:created", function () {
                setFabricSelection(fabricRef.current.getActiveObject());
            });
            fabricRef.current.on("selection:updated", function () {
                setFabricSelection(fabricRef.current.getActiveObject());
            });
            fabricRef.current.on("selection:cleared", function () {
                setFabricSelection(null);
            });
        }, [fabricRef]);
        React.useEffect(() => {
            if (fabricSelection) {
                cidSelectorRef.current.value = fabricSelection._objects[1].text;
            }
        }, [fabricSelection]);

        // Show zoom view on mouse hover
        const [zoomView, setZoomView] = React.useState<string>(null);
        React.useEffect(() => {
            fabricRef.current.on("mouse:move", function (e: any) {
                setZoomView(() => {
                    const currentZoom = fabricRef.current.getZoom();
                   if (currentZoom >= 1) return null;
                   fabricRef.current.setZoom(1.5);
                   const zoomImg = fabricRef.current.toDataURL({top: (e.e.offsetY*(1.5/currentZoom)) - 15, left: (e.e.offsetX*(1.5/currentZoom)) - 30, width: 60, height: 30});
                   fabricRef.current.setZoom(currentZoom);
                   return zoomImg;
                });
            });
            fabricRef.current.on("mouse:out", function (e: any) {
                setZoomView(null);
            });
        }, [fabricRef]);

        // Prevent out of bounds - https://stackoverflow.com/a/42915768
        React.useEffect(() => {
            const preventOutOfBounds = (e: any) => {
                const obj = e.target;
                const top = obj.top;
                const bottom = top + obj.height * obj.scaleY;
                const left = obj.left;
                const right = left + obj.width * obj.scaleX;

                const topBound = (obj.height * obj.scaleY) / 2;
                const bottomBound = topBound + imgEl.height;
                const leftBound = (obj.width * obj.scaleX) / 2;
                const rightBound = leftBound + imgEl.width;

                // capping logic here
                obj.left = Math.min(
                    Math.max(left, leftBound),
                    rightBound - obj.width * obj.scaleX,
                );
                obj.top = Math.min(
                    Math.max(top, topBound),
                    bottomBound - obj.height * obj.scaleY,
                );
            };
            fabricRef.current.on("object:moving", preventOutOfBounds);
            fabricRef.current.on("object:modified", preventOutOfBounds);
        }, [fabricRef]);

        // Handle some key events
        React.useEffect(() => {
            const onKeydown = (e: KeyboardEvent) => {
                if (e.key === "Escape" && fabricRef.current.getActiveObject()) {
                    fabricRef.current.discardActiveObject();
                    fabricRef.current.renderAll();
                    e.stopImmediatePropagation();
                }
                if (e.key === "Delete" && fabricRef.current.getActiveObject()) {
                    deleteOcclusion();
                    e.stopImmediatePropagation();
                }
                if (e.key === "Insert") {
                    addOcclusion();
                    e.stopImmediatePropagation();
                }
                if (e.key === "ArrowUp") {
                    if (fabricRef.current.getActiveObject()) {
                        fabricRef.current.getActiveObject().top -= 1;
                        fabricRef.current.renderAll();
                        e.stopImmediatePropagation();
                    }
                }
                if (e.key === "ArrowDown") {
                    if (fabricRef.current.getActiveObject()) {
                        fabricRef.current.getActiveObject().top += 1;
                        fabricRef.current.renderAll();
                        e.stopImmediatePropagation();
                    }
                }
                if (e.key === "ArrowLeft") {
                    if (fabricRef.current.getActiveObject()) {
                        fabricRef.current.getActiveObject().left -= 1;
                        fabricRef.current.renderAll();
                        e.stopImmediatePropagation();
                    }
                }
                if (e.key === "ArrowRight") {
                    if (fabricRef.current.getActiveObject()) {
                        fabricRef.current.getActiveObject().left += 1;
                        fabricRef.current.renderAll();
                        e.stopImmediatePropagation();
                    }
                }
                if (e.key >= "1" && e.key <= "9") {
                    if (fabricRef.current.getActiveObject()) {
                        cidSelectorRef.current.value = e.key;
                        const event = new Event("change", { bubbles: true });
                        cidSelectorRef.current.dispatchEvent(event);
                        e.stopImmediatePropagation();
                    }
                }
            };
            window.parent.document.addEventListener("keydown", onKeydown, {
                capture: true,
            });
            return () => {
                window.parent.document.removeEventListener(
                    "keydown",
                    onKeydown,
                    { capture: true },
                );
            };
        }, [fabricRef]);

        // Create the UI
        const addOcclusion = () => {
            const randomLocation = {
                x:
                    Math.floor(
                        Math.random() * (imgEl.width - 0.22 * imgEl.width),
                    ) +
                    0.11 * imgEl.width,
                y:
                    Math.floor(
                        Math.random() * (imgEl.height - 0.22 * imgEl.height),
                    ) +
                    0.11 * imgEl.height,
            };
            const occlusionEl = createOcclusionRectEl(
                randomLocation.x,
                randomLocation.y,
                0.22 * imgEl.width,
                0.22 * imgEl.height,
            );
            fabricRef.current.add(occlusionEl);
            fabricRef.current.setActiveObject(occlusionEl);
            fabricRef.current.renderAll();
        };
        const deleteOcclusion = () => {
            fabricRef.current.remove(fabricRef.current.getActiveObject());
            fabricRef.current.renderAll();
        };
        const onCIdChange = () => {
            if (fabricSelection) {
                fabricRef.current
                    .getActiveObject()
                    ._objects[1].set("text", cidSelectorRef.current.value);
                fabricRef.current.renderAll();
            }
        };
        return (
            <div>
                <div
                    className="flex"
                    style={{
                        justifyContent: "space-between",
                        marginTop: "0.3rem",
                        marginBottom: "0.6rem",
                    }}
                >
                    <div className="flex" style={{ alignItems: "center" }}>
                        <i
                            className="ti"
                            dangerouslySetInnerHTML={{ __html: ANKI_ICON }}
                        ></i>
                        <h3 className="text-lg" style={{ marginLeft: "4px" }}>
                            Occlusion Editor
                        </h3>
                    </div>
                    <a href="https://github.com/sponsors/debanjandhar12">
                        <img
                            alt="Donate"
                            style={{ height: "1.6rem" }}
                            src={DONATE_ICON}
                        />
                    </a>
                </div>
                <div
                    className="occlusion-editor-toolbar flex"
                    style={{
                        justifyContent: "end",
                        alignItems: "center",
                        marginBottom: "0.5rem",
                    }}
                >
                    {zoomView && (<span
                    style={{
                        margin: "0.125rem auto 0.125rem 0",
                    }}><img
                        src={zoomView}
                    />&lt;- Zoom</span>)
                    }
                    <button
                        title={"Add Occlusion"}
                        onClick={addOcclusion}
                        className="inline-flex justify-center rounded-md  reduce-opacity-when-disabled not-allowed-cursor-when-disabled bg-indigo-600 hover:bg-indigo-700 focus:border-indigo-700 active:bg-indigo-700 text-center text-sm"
                        style={{
                            margin: "0.125rem 0.25rem 0.125rem 0",
                            padding: ".30rem .30rem",
                        }}
                    >
                        <i style={{color: 'white'}} dangerouslySetInnerHTML={{ __html: ADD_OCCLUSION_ICON }}></i>
                    </button>
                    <button
                        title={"Delete Occlusion"}
                        onClick={deleteOcclusion}
                        className="inline-flex justify-center rounded-md reduce-opacity-when-disabled not-allowed-cursor-when-disabled bg-red-600 hover:bg-red-700 focus:border-red-700 active:bg-red-700 text-center text-sm"
                        style={{
                            margin: "0.125rem 0.25rem 0.125rem 0",
                            padding: ".30rem .30rem",
                        }}
                        disabled={fabricSelection == null}
                    >
                        <i style={{color: 'white'}} dangerouslySetInnerHTML={{ __html: REMOVE_OCCLUSION_ICON }}></i>
                    </button>
                    <span style={{ fontSize: "0.875rem", marginLeft: "1rem" }}>
                        Cloze Id:
                    </span>{" "}
                    <select
                        ref={cidSelectorRef}
                        onChange={onCIdChange}
                        className="form-select is-small"
                        style={{ margin: "0", width: "80px", height: "2.2rem" }}
                        disabled={fabricSelection == null}
                    >
                        {_.range(1, 10).map((i) => (
                            <option key={i} value={i}>
                                {i}
                            </option>
                        ))}
                    </select>
                </div>
                <div
                    className="cloze-editor-canvas-container flex"
                    style={{ justifyContent: "center" }}
                >
                    <canvas ref={canvasRef} />
                </div>
            </div>
        );
    },
);

export function createOcclusionRectEl(
    left = 0,
    top = 0,
    width = 80,
    height = 40,
    angle = 0,
    cId = 1,
) {
    const rect = new window.parent.fabric.Rect({
        fill: "#FFEBA2",
        stroke: "#000",
        strokeWidth: 1,
        strokeUniform: true,
        noScaleCache: false,
        opacity: 0.8,
        width: width,
        height: height,
        originX: "center",
        originY: "center",
    });
    const text = new window.parent.fabric.Text(`${cId}`, {
        originX: "center",
        originY: "center",
    });
    text.scaleToHeight(height);
    const group = new window.parent.fabric.Group([rect, text], {
        left: left,
        top: top,
        width: width,
        height: height,
        originX: "center",
        originY: "center",
        angle: angle,
    });
    return group;
}
