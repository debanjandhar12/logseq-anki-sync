export function registerStyle(enabled: boolean): void {
    const value = 'div[data-property-title="highlight_mask"] .property-value';
    const blockPath = "> div > div > .property-block-container > .ls-block > .block-main-container";
    const nativeInner = `${value} > .property-value-inner:has(${blockPath} > .block-control-wrap)`;
    const nativeMain = `${nativeInner} ${blockPath}:has(> .block-control-wrap)`;
    logseq.provideStyle({
        key: "hide-highlight-mask-data",
        style: enabled
            ? `
            /* File graphs and hosts without property-renderer support retain the original placeholder. */
            div:has(a:is([data-ref="highlight_mask"], [data-ref="highlight-mask"])) + span + .page-property-value > div,
            div:has(a:is([data-ref="highlight_mask"], [data-ref="highlight-mask"])) > .page-property-value > div {
                display: none;
            }
            div:has(a:is([data-ref="highlight_mask"], [data-ref="highlight-mask"])) + span + .page-property-value::before,
            div:has(a:is([data-ref="highlight_mask"], [data-ref="highlight-mask"])) > .page-property-value::before {
                display: inline;
                content: '<hidden highlight mask data>';
                font-style: italic;
            }
            ${value} > .property-value-inner:not(:has(${blockPath} > .block-control-wrap)) {
                display: none;
            }
            div[data-property-title="highlight_mask"] .property-value::before {
                content: '<hidden highlight mask data>';
                font-style: italic;
            }
            /* Retain the native structural chain and bullet, but never show raw content or children. */
            ${nativeInner} > :not(div:has(> div > .property-block-container > .ls-block > .block-main-container > .block-control-wrap)),
            ${nativeInner} > div > :not(div:has(> .property-block-container > .ls-block > .block-main-container > .block-control-wrap)),
            ${nativeInner} > div > div > :not(.property-block-container:has(> .ls-block > .block-main-container > .block-control-wrap)),
            ${nativeInner} > div > div > .property-block-container > :not(.ls-block:has(> .block-main-container > .block-control-wrap)),
            ${nativeInner} > div > div > .property-block-container > .ls-block > :not(.block-main-container:has(> .block-control-wrap)),
            ${nativeMain} > :not(.block-control-wrap):not(.anki-sync-highlight-mask-summary) {
                display: none;
            }
            ${nativeMain}::before {
                content: '<hidden highlight mask data>';
                font-style: italic;
                order: 1;
            }
            ${nativeMain} > .anki-sync-highlight-mask-summary {
                order: 1;
            }
            /* The loading placeholder shares the bullet's row; the portal replaces only that placeholder. */
            ${value}:has(> .property-value-inner ${blockPath} > .block-control-wrap)::before,
            ${value}:has(> .anki-sync-highlight-mask-summary)::before,
            ${nativeMain}:has(> .anki-sync-highlight-mask-summary)::before {
                content: none;
            }
        `
            : ""
    });
}
