// Tailwind v4 applies opacity modifiers to CSS color values without a color callback.
export const logseqColor = (cssVariable, fallback) => `var(${cssVariable}, ${fallback})`;
