/***
 * This files contains the js for the both sides of anki cards.
 */

// ---- Global Functions ----
window.scrollToClozeElement = () => {
    const element = document.getElementsByClassName("cloze")[0];
    element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center"
    });
    // biome-ignore lint/suspicious/noConsole: runs in anki
    console.log("Scrolled to cloze element");
};

window.openBlockInLogseq = (logseqBlockUUID) => {
    if (logseqBlockUUID == null || logseqBlockUUID === "") return;
    const element = document.getElementsByClassName("breadcrumb2")[0];
    // javascript get first child link element
    const page_link = element.getElementsByTagName("a")[0];
    const block_link = document.createElement("a");
    block_link.href = `${page_link.href.match(/logseq:\/\/graph\/.*\?/)}block-id=${logseqBlockUUID}`;
    block_link.click();
};

// ---- On Load Functions ----
const onLoadHandler = () => {
    displayTag();
    handleTypeInTag();
};

function displayTag() {
    const tags = document.getElementsByClassName("tag");
    for (const tag of tags) {
        if (tag.getAttribute("data-ref")) {
            tag.textContent = tag.getAttribute("data-ref");
        }
    }
}
function handleTypeInTag() {
    if (window.type === "image_occlusion") return;
    if (document.getElementById("tags").getAttribute("tags_name").split(" ").includes("type-in")) {
        document.getElementsByClassName("type-in-container")[0].style.display = "block";
    }
}

if (document.readyState === "complete") {
    onLoadHandler();
    window.addEventListener("load", onLoadHandler);
} else {
    window.addEventListener("load", onLoadHandler);
}
