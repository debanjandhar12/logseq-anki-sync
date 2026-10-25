import type {BlockPropertiesRendererProps} from "@logseq/libs/dist/modules/LSPlugin.Experiments";
import {useRef} from "react";
import {createPortal} from "react-dom";
import editIcon from "../../../node_modules/@tabler/icons/icons/outline/edit.svg?raw";
import {useHighlightMaskCount} from "./hooks/useHighlightMaskCount";
import {useHighlightMaskValueTargets} from "./hooks/useHighlightMaskValueTargets";
import {openEditor} from "./openEditor";
import {normalizeRendererProperties} from "./utils/normalizeRendererProperties";

const inlineEditIcon = editIcon
    .replace('width="24"', 'width="1em"')
    .replace('height="24"', 'height="1em"');

export function HighlightMaskPropertyRenderer({blockId, properties}: BlockPropertiesRendererProps) {
    const anchor = useRef<HTMLSpanElement>(null);
    const targets = useHighlightMaskValueTargets(anchor);
    const {count, refresh} = useHighlightMaskCount(
        blockId,
        normalizeRendererProperties(properties).highlight_mask
    );
    const summary =
        count === null
            ? "<hidden highlight mask data>"
            : `<hidden highlight mask data with ${count} cards>`;

    const content = (
        <span
            className="anki-sync-highlight-mask-summary"
            onPointerDown={(event) => event.stopPropagation()}>
            <span style={{fontStyle: "italic"}}>{summary}</span>{" "}
            {/* biome-ignore lint/a11y/useValidAnchor: Keep Logseq's native link styling; the editor action prevents navigation. */}
            {/* biome-ignore lint/a11y/useAnchorContent: The icon-only action has an accessible aria-label. */}
            <a
                href="#"
                aria-label="Edit highlight masks"
                title="Edit highlight masks"
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void openEditor(blockId).then(refresh);
                }}>
                <span
                    aria-hidden="true"
                    style={{display: "inline-flex", verticalAlign: "middle", fontSize: "1.2em"}}
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG comes from a trusted, bundled Tabler asset, not user content.
                    dangerouslySetInnerHTML={{__html: inlineEditIcon}}
                />
            </a>
        </span>
    );

    return (
        <span ref={anchor} hidden className="anki-sync-highlight-mask-anchor">
            {targets.map((target, index) => createPortal(content, target, String(index)))}
        </span>
    );
}
