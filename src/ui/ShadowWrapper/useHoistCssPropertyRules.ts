import {useEffect} from "react";

/**
 * Splits CSS into `@property` rules and remaining CSS.
 *
 * Tailwind v4 uses CSS `@property` to register custom properties with initial
 * values (e.g. `--tw-border-style` with `initial-value: solid`). `@property`
 * is a document-level feature that browsers ignore inside Shadow DOM, causing
 * utilities like `border`, `shadow`, `ring`, and `outline` to silently break.
 *
 * By extracting these rules, we can hoist them to the host document where they
 * are properly registered and apply globally — including inside shadow roots.
 */
export function splitAtPropertyRules(css: string): {
    propertyRules: string;
    shadowCss: string;
} {
    const propertyRuleRegex = /@property\s+[^{]+\{[^}]*\}/g;
    const matches = css.match(propertyRuleRegex) || [];
    const shadowCss = css.replace(propertyRuleRegex, "");
    return {
        propertyRules: matches.join("\n"),
        shadowCss
    };
}

/**
 * Hoists Tailwind v4 `@property` rules to the host document where they are
 * supported. Without this, utilities depending on registered custom properties
 * (border, shadow, ring, outline, etc.) break inside Shadow DOM.
 *
 * Injects a `<style data-tailwind-property-rules>` element into the document
 * head on mount and removes it on unmount.
 */
export function useHoistCssPropertyRules(host: HTMLElement | null, propertyRules: string): void {
    useEffect(() => {
        if (!host || !propertyRules) {
            return;
        }

        const doc = host.ownerDocument;
        const style = doc.createElement("style");
        style.setAttribute("data-tailwind-property-rules", "");
        style.textContent = propertyRules;
        doc.head.appendChild(style);

        return () => {
            style.remove();
        };
    }, [host, propertyRules]);
}
