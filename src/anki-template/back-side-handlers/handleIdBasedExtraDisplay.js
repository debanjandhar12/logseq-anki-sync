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
    const clozeData = content.querySelector("[data-id-based-extras]");
    const occlusionData = content.querySelector("#imgToOcclusionDataHashMap");
    const highlightData = content.querySelector("#highlightMaskData");
    let elements;
    try {
        if (clozeData) {
            elements = JSON.parse(decodeURIComponent(clozeData.textContent)).elements;
        } else if (occlusionData) {
            const data = JSON.parse(
                occlusionData.dataset.encoding === "uri"
                    ? decodeURIComponent(occlusionData.textContent)
                    : occlusionData.innerHTML
            );
            elements = Object.values(data).flatMap((image) => image?.elements ?? []);
        } else if (highlightData) {
            elements = JSON.parse(decodeURIComponent(highlightData.textContent)).elements;
        }
    } catch {
        // Invalid metadata must not interrupt the remaining card handlers.
        return;
    }
    if (!Array.isArray(elements)) return;

    // Rebuild only generated extras; retained markers allow safe repeated execution.
    content.querySelectorAll("[data-element-extra]").forEach((extra) => extra.remove());
    const globalExtra = content.querySelector(".extra-block");
    for (const element of elements) {
        if (!element || !activeIds.has(String(element.cId))) continue;
        if (typeof element.extra !== "string" || !element.extra.trim()) continue;
        const extra = document.createElement("div");
        extra.className = "extra extra-block";
        extra.dataset.elementExtra = String(element.cId);
        extra.style.whiteSpace = "pre-wrap";
        extra.textContent = element.extra;
        if (globalExtra) globalExtra.before(extra);
        else content.appendChild(extra);
    }
}
