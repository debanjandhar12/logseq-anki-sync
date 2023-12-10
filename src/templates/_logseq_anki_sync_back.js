/***
 * This files contains the js for the back side of anki cards.
 */

const onLoadHandler = () => {
    if (type == "image_occlusion") {
        // Show the main content
        document.getElementById("main-content").style.visibility = "visible";
    }
};

if (document.readyState === "complete") {
    onLoadHandler();
} else {
    window.addEventListener("load", onLoadHandler);
}
