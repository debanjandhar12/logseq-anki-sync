// Tailwind calls color entries as functions for opacity modifiers like `text-foreground/80`.
// This utility method keeps those variants working.
export const logseqColor = (cssVariable, fallback) => {
    return ({opacityValue}) => {
        const color = `var(${cssVariable}, ${fallback})`;

        const opacityNumber = Number(opacityValue);

        if (opacityValue === undefined || Number.isNaN(opacityNumber)) {
            return color;
        }

        return `color-mix(in srgb, ${color} ${opacityNumber * 100}%, transparent)`;
    };
};
