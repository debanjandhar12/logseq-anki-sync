import type React from "react";
import type {FC} from "react";

export const DEFAULT_TABLER_ICON_SIZE = 16;

export interface TablerIconProps {
    /** Raw SVG string, e.g. imported via `import X_ICON from "@tabler/icons/outline/x.svg?raw"`. */
    icon?: string;
    /** Rendered size in px. Defaults to 16, matching the `h-4 w-4` size of LogseqCheckbox. */
    size?: number;
    className?: string;
    /** Native tooltip rendered on the wrapper span. */
    title?: string;
    style?: React.CSSProperties;
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
    style
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
            // biome-ignore lint/security/noDangerouslySetInnerHtml: icon is a bundled @tabler/icons asset, not user content
            dangerouslySetInnerHTML={{__html: sizedIcon}}
        />
    );
};
