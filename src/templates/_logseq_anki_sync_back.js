/***
 * This files contains the js for the back side of anki cards.
 */

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
    if (window.type === "image_occlusion") return;
    if (document.getElementById('tags').getAttribute('tags_name').split(' ')
        .includes('type-in')) {
        document.getElementsByClassName('type-in')[0].style.display = "block";
    }
}

if (document.readyState === "complete") {
    onLoadHandler();
} else {
    window.addEventListener("load", onLoadHandler);
}
