export function registerStyle(enabled: boolean): void {
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
            div[data-property-title="highlight_mask"] .property-value-inner {
                display: none;
            }
            div[data-property-title="highlight_mask"] .property-value::before {
                content: '<hidden highlight mask data>';
                font-style: italic;
            }
            /* Preserve the native row and label. Only replace the value's placeholder. */
            div[data-property-title="highlight_mask"] .property-value:has(> .anki-sync-highlight-mask-summary)::before {
                content: none;
            }
        `
            : ""
    });
}
