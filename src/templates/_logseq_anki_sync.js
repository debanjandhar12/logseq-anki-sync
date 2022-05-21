/***
* This files contains the js for the both sides of anki cards. 
*/

function scrollToClozeElement() {
    let element = document.getElementsByClassName("cloze")[0];
    element.scrollIntoView({behavior: "smooth", block: "center", inline: "center"});
    console.log("Scrolled to cloze element");
}

function openBlockInLogseq(uuid) {
    if(uuid == null || uuid == "") return;
    let element = document.getElementsByClassName("breadcrumb2")[0];
    // javascript get first child link element
    let link = element.getElementsByTagName("a")[0];
    window.open(`${link.href.match(/logseq:\/\/graph\/.*\?/)}block-id=${uuid}`, '_blank')
}