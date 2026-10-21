import {handleTypeInEnterKey} from "./handleTypeInEnterKey.js";

/** Initialize the existing single-line type-in input; the card markup stays unchanged. */
export function handleTypeInTagTextarea() {
    const input = document.querySelector("input#typeans");
    if (!input) return;
    localStorage.setItem("logseq-prev-typeans", "");
    let resized = false;
    let warning;
    let warningTimer;
    const onResize = () => {
        resized = true;
    };
    const onFocus = () => {
        if (typeof AnkiDroidJS === "undefined" || resized || warning || warningTimer) return;
        warningTimer = setTimeout(() => {
            warningTimer = undefined;
            if (resized || !input.isConnected) return;
            warning = document.createElement("div");
            Object.assign(warning.style, {
                color: "red",
                fontSize: "small",
                marginTop: "5px",
                textAlign: "left",
                float: "left"
            });
            warning.textContent =
                'Ankidroid doesn\'t support virtual keyboard by default. Please go to Settings > Advanced and enable "Type answer into the card".';
            input.parentNode.appendChild(warning);
        }, 200);
    };
    const saveAnswer = () => localStorage.setItem("logseq-prev-typeans", input.value);
    window.addEventListener("resize", onResize);
    input.addEventListener("focusin", onFocus);
    input.addEventListener("change", saveAnswer);
    input.addEventListener("keyup", saveAnswer);
    const cleanUpEnterKey = handleTypeInEnterKey(input);
    try {
        input.focus();
        input.click();
    } catch (_e) {}
    return () => {
        clearTimeout(warningTimer);
        warning?.remove();
        window.removeEventListener("resize", onResize);
        input.removeEventListener("focusin", onFocus);
        input.removeEventListener("change", saveAnswer);
        input.removeEventListener("keyup", saveAnswer);
        cleanUpEnterKey();
    };
}
