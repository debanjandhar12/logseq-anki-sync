import type {BlockPropertiesRendererProps} from "@logseq/libs/dist/modules/LSPlugin.Experiments";
import {useRef} from "react";
import {createPortal} from "react-dom";
import {useOcclusionCount} from "./hooks/useOcclusionCount";
import {useOcclusionValueTargets} from "./hooks/useOcclusionValueTargets";
import {openEditor} from "./openEditor";
import {normalizeRendererProperties} from "./utils/normalizeRendererProperties";

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
            <span style={{fontStyle: "italic"}}>{summary}</span>
            {" ("}
            {/* biome-ignore lint/a11y/useValidAnchor: Keep Logseq's native link styling; the editor action prevents navigation. */}
            <a
                href="#"
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void openEditor(blockId).then(refresh);
                }}>
                Edit
            </a>
            {")"}
        </span>
    );

    return (
        <span ref={anchor} hidden className="anki-sync-occlusion-anchor">
            {targets.map((target, index) => createPortal(content, target, String(index)))}
        </span>
    );
}
