import type {BlockPropertiesRendererProps} from "@logseq/libs/dist/modules/LSPlugin.Experiments";
import {useRef} from "react";
import {createPortal} from "react-dom";
import editIcon from "../../../node_modules/@tabler/icons/icons/outline/edit.svg?raw";
import {useOcclusionCount} from "./hooks/useOcclusionCount";
import {useOcclusionValueTargets} from "./hooks/useOcclusionValueTargets";
import {openEditor} from "./openEditor";
import {normalizeRendererProperties} from "./utils/normalizeRendererProperties";

const inlineEditIcon = editIcon
    .replace('width="24"', 'width="1em"')
    .replace('height="24"', 'height="1em"');

export function OcclusionPropertyRenderer({blockId, properties}: BlockPropertiesRendererProps) {
    const anchor = useRef<HTMLSpanElement>(null);
    const targets = useOcclusionValueTargets(anchor);
    const {count, refresh} = useOcclusionCount(
        blockId,
        normalizeRendererProperties(properties).occlusion
    );
    const summary =
        count === null ? "<hidden occlusion data>" : `<hidden occlusion data with ${count} cards>`;

    const content = (
        <span
            className="anki-sync-occlusion-summary"
            onPointerDown={(event) => event.stopPropagation()}>
            <span style={{fontStyle: "italic"}}>{summary}</span>{" "}
            {/* biome-ignore lint/a11y/useValidAnchor: Keep Logseq's native link styling; the editor action prevents navigation. */}
            {/* biome-ignore lint/a11y/useAnchorContent: The icon-only action has an accessible aria-label. */}
            <a
                href="#"
                aria-label="Edit image occlusions"
                title="Edit image occlusions"
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
        <span ref={anchor} hidden className="anki-sync-occlusion-anchor">
            {targets.map((target, index) => createPortal(content, target, String(index)))}
        </span>
    );
}
