export function handleTagRendering() {
    for (const tag of document.getElementsByClassName("tag")) {
        const reference = tag.getAttribute("data-ref");
        if (reference) tag.textContent = reference;
    }
}
