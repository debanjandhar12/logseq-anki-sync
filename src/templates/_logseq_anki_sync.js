/***
 * This files contains the js for the both sides of anki cards.
 */

// ---- Global Functions ----
window.scrollToClozeElement = () => {
    let element = document.getElementsByClassName("cloze")[0];
    element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
    });
    console.log("Scrolled to cloze element");
};

window.openBlockInLogseq = (uuid) => {
    if (uuid == null || uuid == "") return;
    let element = document.getElementsByClassName("breadcrumb2")[0];
    // javascript get first child link element
    let page_link = element.getElementsByTagName("a")[0];
    let block_link = document.createElement("a");
    block_link.href = `${page_link.href.match(/logseq:\/\/graph\/.*\?/)}block-id=${uuid}`;
    block_link.click();
};


// ---- On Load Functions ----
const onLoadHandler = () => {
    displayTag();
    handleTypeInTag();
};

function displayTag() {
    let tags = document.getElementsByClassName('tag');
    for (let tag of tags) {
        if (tag.getAttribute('data-ref')) {
            tag.textContent = tag.getAttribute('data-ref');
        }
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