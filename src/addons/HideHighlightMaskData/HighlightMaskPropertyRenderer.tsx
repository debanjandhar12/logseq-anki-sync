import type {BlockPropertiesRendererProps} from "@logseq/libs/dist/modules/LSPlugin.Experiments";
import EDIT_ICON from "@tabler/icons/outline/edit.svg?raw";
import {useRef} from "react";
import {createPortal} from "react-dom";
import {TablerIcon} from "../../ui/components/TablerIcon";
import {useHighlightMaskCount} from "./hooks/useHighlightMaskCount";
import {useHighlightMaskValueTargets} from "./hooks/useHighlightMaskValueTargets";
import {openEditor} from "./openEditor";
import {normalizeRendererProperties} from "./utils/normalizeRendererProperties";

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
            <a
                href="#"
                aria-label="Edit highlight masks"
                title="Edit highlight masks"
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void openEditor(blockId).then(refresh);
                }}>
                <TablerIcon
                    icon={EDIT_ICON}
                    size="1em"
                    aria-hidden="true"
                    style={{verticalAlign: "middle", fontSize: "1.2em"}}
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
