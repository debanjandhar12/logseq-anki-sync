export function findHighlightMaskValueTargets(anchor: HTMLElement): HTMLElement[] {
    const area = anchor.closest(".ls-properties-area");
    if (!area) return [];
    return Array.from(
        area.querySelectorAll<HTMLElement>('[data-property-title="highlight_mask"] .property-value')
    )
        .filter(
            (value) =>
                value.closest(".ls-properties-area") === area &&
                value.closest("[data-property-title]")?.getAttribute("data-property-title") ===
                    "highlight_mask"
        )
        .flatMap((value) => {
            const blocks = Array.from(
                value.querySelectorAll<HTMLElement>(
                    ":scope > .property-value-inner > div > div > .property-block-container > .ls-block > .block-main-container:has(> .block-control-wrap)"
                )
            );
            return blocks.length > 0 ? blocks : [value];
        });
}
