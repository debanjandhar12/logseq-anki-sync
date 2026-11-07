import type React from "react";
import type {FC} from "react";

export const DEFAULT_TABLER_ICON_SIZE = 16;

export interface TablerIconProps extends React.HTMLAttributes<HTMLSpanElement> {
    /** Raw SVG string, e.g. imported via `import X_ICON from "@tabler/icons/outline/x.svg?raw"`. */
    icon?: string;
    /**
     * Rendered size. Numbers are pixels and default to 16, matching the `h-4 w-4`
     * size of LogseqCheckbox. CSS length strings (e.g. "1em") pass through
     * (same pattern as OcclusionPropertyRenderer's em sizing).
     */
    size?: number | string;
}

const TABLER_SVG_WIDTH_ATTR = 'width="24"';
const TABLER_SVG_HEIGHT_ATTR = 'height="24"';

/**
 * Renders a bundled @tabler/icons SVG (imported with `?raw`) inline.
 * The SVG is sized via string replacement (same pattern as OcclusionPropertyRenderer)
 * and colored through `currentColor`, so it inherits the wrapper's text color
 * (e.g. Tailwind classes like `text-success` / `text-danger`).
 */
export const TablerIcon: FC<TablerIconProps> = ({
    icon,
    size = DEFAULT_TABLER_ICON_SIZE,
    className,
    title,
    style,
    ...rest
}) => {
    if (!icon) return null;
    const sizedIcon = icon
        .replace(TABLER_SVG_WIDTH_ATTR, `width="${size}"`)
        .replace(TABLER_SVG_HEIGHT_ATTR, `height="${size}"`);
    return (
        <span
            className={className}
            title={title}
            style={{
                display: "inline-flex",
                alignItems: "center",
                flexShrink: 0,
                userSelect: "none",
                ...style
            }}
            {...rest}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: icon is a bundled @tabler/icons asset, not user content
            dangerouslySetInnerHTML={{__html: sizedIcon}}
        />
    );
};
