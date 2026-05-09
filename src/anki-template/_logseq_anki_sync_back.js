/***
 * This files contains the js for the back side of anki cards.
 */
import {compareAnswer} from "./compareAnswer";

const onLoadHandler = () => {
    if (!document.getElementsByClassName("anki-card-back-side")[0]) {
        // biome-ignore lint/suspicious/noConsole: runs in anki
        console.log("Not back side of anki card");
        return;
    }
    handleImageOcclusion();
    handleTypeInTag();
};

function handleImageOcclusion() {
    if (window.type === "image_occlusion") {
        // Show the main content
        document.getElementById("main-content").style.visibility = "visible";
    }
}

function handleTypeInTag() {
    const typeans = document.getElementById("typeans");
    if (typeans) {
        const provided = localStorage.getItem("logseq-prev-typeans");

        // get expected
        const cloze = document.getElementsByClassName("cloze");
        const expected = Array.from(cloze)
            .map((el) => el.innerText)
            .join(", ");

        // compare and render
        const newDiv = document.createElement("div");
        newDiv.id = "typeans";
        newDiv.innerHTML = compareAnswer(expected, provided);
        typeans.replaceWith(newDiv);
    }
}

if (document.readyState === "complete") {
    onLoadHandler();
    window.addEventListener("load", onLoadHandler);
} else {
    window.addEventListener("load", onLoadHandler);
}
