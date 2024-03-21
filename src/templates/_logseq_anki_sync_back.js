/***
 * This files contains the js for the back side of anki cards.
 */

const onLoadHandler = () => {
    if (!document.getElementsByClassName("anki-card-back-side")[0]) {
        console.log("Not back side of anki card");
        return;
    }
    handleImageOcclusion();
};

function handleImageOcclusion() {
    if (window.type == "image_occlusion") {
        // Show the main content
        document.getElementById("main-content").style.visibility = "visible";
    }
}

if (document.readyState === "complete") {
    onLoadHandler();
    window.addEventListener("load", onLoadHandler);
} else {
    window.addEventListener("load", onLoadHandler);
}