/***
 * This files contains the js for the front side of anki cards.
 */
import {fabric} from "fabric";
import path from "path-browserify";
import {createOcclusionRectEl} from "../utils/occlusionUtils";

const onLoadHandler = () => {
    if (!document.getElementsByClassName("anki-card-front-side")[0]) {
        // biome-ignore lint/suspicious/noConsole: runs in anki
        console.log("Not front side of anki card");
        return;
    }
    handleImageOcclusion();
    handleShowAllTestOneTagForClozesAndHighlightAndMultilineIncrementalCards();
    handleTypeInTag();
};

function handleImageOcclusion() {
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
    const images = Array.from(document.getElementsByTagName("img"));
    for (const image of images) {
        image.style.visibility = "hidden";
        const canvasEl = document.createElement("canvas");
        canvasEl.width = image.width;
        canvasEl.height = image.height;
        const canvas = new fabric.Canvas(canvasEl, {
            imageSmoothingEnabled: false
        });
        const imgEl = new Image();
        imgEl.src = image.src;
        imgEl.onload = () => {
            const imgFabric = new fabric.Image(imgEl);
            const scaleX = canvas.width / imgFabric.width,
                scaleY = canvas.height / imgFabric.height;
            canvas.setViewportTransform([scaleX, 0, 0, scaleY, 0, 0]);
            canvas.setBackgroundImage(imgFabric, canvas.renderAll.bind(canvas), {
                scaleX: 1,
                scaleY: 1
            });
        };
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
            if (occlusionElem.cId === currentClozeId) {
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
}

function handleShowAllTestOneTagForClozesAndHighlightAndMultilineIncrementalCards() {
    if (
        window.type !== "multiline_card" &&
        window.type !== "cloze" &&
        window.type !== "highlight_mask"
    )
        return;
    if (
        !document
            .getElementById("tags")
            .getAttribute("tags_name")
            .split(" ")
            .includes("hide-all-test-one")
    )
        return; // If the card does not have the tag, do nothing

    [...document.getElementsByClassName("cloze-inactive")].forEach((el) => {
        function hideElement(el) {
            if (el.classList.contains("cloze-inactive-hidden")) return;
            el.classList.add("cloze-inactive-hidden");
            el.setAttribute("data-html-content", el.innerHTML);
            el.innerHTML = "[...]";
            el.style.color = "rgb(115, 115, 115)";
            el.style.cursor = "pointer";
        }
        function showElement(el) {
            if (!el.classList.contains("cloze-inactive-hidden")) return;
            el.classList.remove("cloze-inactive-hidden");
            el.innerHTML = el.getAttribute("data-html-content");
        }
        function toggleVisibility(el) {
            if (el.classList.contains("cloze-inactive-hidden")) {
                showElement(el);
            } else {
                hideElement(el);
            }
        }
        el.onclick = () => {
            toggleVisibility(el);
        };
        hideElement(el);
    });
}

function handleTypeInTag() {
    localStorage.setItem("logseq-prev-typeans", "");
    const typeans = document.getElementById("typeans");
    if (typeans == null) return;
    try {
        typeans.focus();
        typeans.click();
    } catch (_e) {}
    try {
        let resized = false;
        typeans.addEventListener("focusin", async (_event) => {
            if (!AnkiDroidJS) return;
            if (!resized) {
                window.addEventListener("resize", () => {
                    resized = true;
                });
            }
            await new Promise((r) => setTimeout(r, 200));
            if (!resized) {
                const warning = document.createElement("div");
                warning.style.color = "red";
                warning.style.fontSize = "small";
                warning.style.marginTop = "5px";
                warning.style.textAlign = "left";
                warning.style.float = "left";
                warning.innerHTML =
                    'Ankidroid doesn\'t support virtual keyboard by default. Please go to Settings > Advanced and enable "Type answer into the card".';
                typeans.parentNode.appendChild(warning);
            }
        });
    } catch (_e) {}
    const onInput = (_e) => {
        localStorage.setItem("logseq-prev-typeans", typeans.value);
    };
    typeans.onchange = onInput;
    typeans.onkeyup = onInput;
}

if (document.readyState === "complete") {
    onLoadHandler();
    window.addEventListener("load", onLoadHandler);
} else {
    window.addEventListener("load", onLoadHandler);
}
