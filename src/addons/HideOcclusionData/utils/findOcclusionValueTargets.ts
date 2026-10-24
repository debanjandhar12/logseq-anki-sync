export function findOcclusionValueTargets(anchor: HTMLElement): HTMLElement[] {
    const area = anchor.closest(".ls-properties-area");
    if (!area) return [];
    return Array.from(
        area.querySelectorAll<HTMLElement>('[data-property-title="occlusion"] .property-value')
    ).filter(
        (value) =>
            value.closest(".ls-properties-area") === area &&
            value.closest("[data-property-title]")?.getAttribute("data-property-title") ===
                "occlusion"
    );
}
