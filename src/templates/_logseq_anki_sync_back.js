/***
 * This files contains the js for the back side of anki cards.
 */
import {compareAnswer} from "./compareAnswer";

const onLoadHandler = () => {
    if (!document.getElementsByClassName("anki-card-back-side")[0]) {
        console.log("Not back side of anki card");
        return;
    }
    handleImageOcclusion();
    handleTypeInTag();
};

function handleImageOcclusion() {
    if (window.type == "image_occlusion") {
        // Show the main content
        document.getElementById("main-content").style.visibility = "visible";
    }
}

function handleTypeInTag() {
    let typeans = document.getElementById("typeans");
    if (typeans) {
        const provided = localStorage.getItem("logseq-prev-typeans");

        // get expected
        let cloze = document.getElementsByClassName("cloze");
        let expected = Array.from(cloze).map((el) => el.innerText).join(", ");

        // compare and render
        let newDiv = document.createElement("div");
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