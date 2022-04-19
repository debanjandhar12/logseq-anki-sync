/***
* This files contains the js for the both sides of anki cards. 
*/

function scrollToClozeElement() {
    let element = document.getElementsByClassName("cloze")[0];
    element.scrollIntoView({behavior: "smooth", block: "center", inline: "center"});
    console.log("Scrolled to cloze element");
}