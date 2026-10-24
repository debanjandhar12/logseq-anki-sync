/**
 * Displays ID-specific extra details for Highlight Notes, Cloze Notes, and Occlusion Notes.
 * Individual notes add data-element-extra-markers, which are used to determine
 * which extra details to show.
 */
export function handleIdBasedExtraDisplay() {
    const content = document.getElementById("main-content");
    if (!content || !document.querySelector(".anki-card-back-side")) return;
    const markers = content.querySelector("[data-element-extra-markers]");
    if (!markers) return;

    const activeIds = new Set(
        Array.from(markers.querySelectorAll(".cloze [data-element-extra-cloze]")).map(
            (marker) => marker.dataset.elementExtraCloze
        )
    );
    const extraData = content.querySelector("[data-id-based-extras]");
    if (!extraData) return;
    let elements;
    try {
        elements = JSON.parse(decodeURIComponent(extraData.textContent)).elements;
    } catch {
        // Invalid metadata must not interrupt the remaining card handlers.
        return;
    }
    if (!Array.isArray(elements)) return;

    // Rebuild only generated extras; retained markers allow safe repeated execution.
    content.querySelectorAll("[data-element-extra]").forEach((extra) => extra.remove());
    const globalExtra = content.querySelector(".extra-block");
    const renderedExtras = [];
    for (const element of elements) {
        if (!element || !activeIds.has(String(element.cId))) continue;
        if (typeof element.html !== "string" || !element.html.trim()) continue;
        const extra = document.createElement("div");
        extra.className = "extra extra-block";
        extra.dataset.elementExtra = String(element.cId);
        extra.innerHTML = element.html;
        renderedExtras.push(extra);
        if (globalExtra) globalExtra.before(extra);
        else content.appendChild(extra);
    }

    // Extras are inserted after Anki's initial math pass. Typeset only these nodes.
    const mathJax = window.MathJax;
    if (!renderedExtras.length || !mathJax?.typesetPromise) return;
    let disposed = false;
    Promise.resolve(mathJax.startup?.promise)
        .then(() => {
            if (!disposed && renderedExtras.every((extra) => extra.isConnected)) {
                return mathJax.typesetPromise(renderedExtras);
            }
        })
        .catch(() => {
            // Math failure must not interrupt the other card handlers.
        });
    return () => {
        disposed = true;
        mathJax.typesetClear?.(renderedExtras);
    };
}
