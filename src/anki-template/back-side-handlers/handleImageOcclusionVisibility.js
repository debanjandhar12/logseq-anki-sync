export function handleImageOcclusionVisibility() {
    if (window.type === "image_occlusion") {
        const content = document.getElementById("main-content");
        if (content) content.style.visibility = "visible";
    }
}
