import {getAnswerClozeElements} from "../utils/getAnswerClozeElements.js";

export function handleScrollToClozeElement() {
    const action = document.querySelector('[data-card-action="scroll-to-cloze"]');
    const scrollToClozeElement = () => {
        getAnswerClozeElements()[0]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center"
        });
    };
    const onKeydown = (event) => {
        // Shift + J to scroll to the active cloze.
        if (event.shiftKey && event.keyCode === 74) scrollToClozeElement();
    };
    action?.addEventListener("click", scrollToClozeElement);
    document.addEventListener("keydown", onKeydown, true);
    return () => {
        action?.removeEventListener("click", scrollToClozeElement);
        document.removeEventListener("keydown", onKeydown, true);
    };
}
