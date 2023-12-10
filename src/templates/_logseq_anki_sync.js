/***
 * This files contains the js for the both sides of anki cards.
 */

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
