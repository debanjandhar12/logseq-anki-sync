import {compareAnswer} from "../type-in-comparator/index.js";
import {getAnswerClozeElements} from "../utils/getAnswerClozeElements.js";

export function handleTypeInTagResult() {
    const input = document.querySelector("input#typeans");
    if (!input) return;
    const provided = localStorage.getItem("logseq-prev-typeans");
    const expected = getAnswerClozeElements()
        .map((element) => element.innerText)
        .join(", ");
    const result = document.createElement("div");
    result.id = "typeans";
    result.innerHTML = compareAnswer(expected, provided);
    input.replaceWith(result);
}
