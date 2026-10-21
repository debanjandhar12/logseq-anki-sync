export function handleHideAllTestOneTag() {
    if (!["multiline_card", "cloze", "highlight_mask"].includes(window.type)) return;
    const tags = document.getElementById("tags")?.getAttribute("tags_name")?.split(" ") || [];
    if (!tags.includes("hide-all-test-one")) return;
    const cleanups = [];
    for (const element of document.getElementsByClassName("cloze-inactive")) {
        const hide = () => {
            if (element.classList.contains("cloze-inactive-hidden")) return;
            element.classList.add("cloze-inactive-hidden");
            element.setAttribute("data-html-content", element.innerHTML);
            element.innerHTML = "[...]";
            element.style.color = "rgb(115, 115, 115)";
            element.style.cursor = "pointer";
        };
        const toggle = () => {
            if (element.classList.contains("cloze-inactive-hidden")) {
                element.classList.remove("cloze-inactive-hidden");
                element.innerHTML = element.getAttribute("data-html-content");
            } else hide();
        };
        element.addEventListener("click", toggle);
        cleanups.push(() => element.removeEventListener("click", toggle));
        hide();
    }
    return () => {
        for (const cleanup of cleanups) cleanup();
    };
}
