export function registerStyle(enabled: boolean): void {
    logseq.provideStyle({
        key: "hide-occlusion-data",
        style: enabled
            ? `
            /* File graphs and hosts without property-renderer support retain the original placeholder. */
            div:has(a[data-ref="occlusion"]) + span + .page-property-value > div,
            div:has(a[data-ref="occlusion"]) > .page-property-value > div {
                display: none;
            }
            div:has(a[data-ref="occlusion"]) + span + .page-property-value::before,
            div:has(a[data-ref="occlusion"]) > .page-property-value::before {
                display: inline;
                content: '<hidden occlusion data>';
                font-style: italic;
            }
            div[data-property-title="occlusion"] .property-value-inner {
                display: none;
            }
            div[data-property-title="occlusion"] .property-value::before {
                content: '<hidden occlusion data>';
                font-style: italic;
            }
            /* Preserve the native row and label. Only replace the value's placeholder. */
            div[data-property-title="occlusion"] .property-value:has(> .anki-sync-occlusion-summary)::before {
                content: none;
            }
        `
            : ""
    });
}
