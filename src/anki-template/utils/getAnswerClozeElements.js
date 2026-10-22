/** Synthetic clozes identify the active card; they are metadata, not answers. */
export function getAnswerClozeElements(root = document) {
    return Array.from(root.querySelectorAll(".cloze")).filter(
        (cloze) => !cloze.closest("[data-element-extra-markers]")
    );
}
