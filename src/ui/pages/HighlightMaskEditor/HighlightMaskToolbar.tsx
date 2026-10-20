import _ from "lodash";
import type {Dispatch, SetStateAction} from "react";
import HINT_ICON from "../../../../node_modules/@tabler/icons/icons/outline/bulb.svg?raw";
import ADD_ICON from "../../../../node_modules/@tabler/icons/icons/outline/plus.svg?raw";
import SETTINGS_ICON from "../../../../node_modules/@tabler/icons/icons/outline/settings.svg?raw";
import REMOVE_ICON from "../../../../node_modules/@tabler/icons/icons/outline/trash.svg?raw";
import {LogseqButton} from "../../components/LogseqButton";
import {LogseqCheckbox} from "../../components/LogseqCheckbox";
import {LogseqPopover} from "../../components/LogseqPopover";
import {LogseqSelect} from "../../components/LogseqSelect";
import {LogseqTooltip} from "../../components/LogseqTooltip";

interface HighlightMaskToolbarProps {
    selected: boolean;
    hint?: string;
    clozeId: string;
    hasTextSelection: boolean;
    tags: string[];
    setTags: Dispatch<SetStateAction<string[]>>;
    onClozeIdChange: (value: string) => void;
    onHint: () => void;
    onAdd: () => void;
    onDelete: () => void;
}

export function HighlightMaskToolbar({
    selected,
    hint,
    clozeId,
    hasTextSelection,
    tags,
    setTags,
    onClozeIdChange,
    onHint,
    onAdd,
    onDelete
}: HighlightMaskToolbarProps) {
    const groupStyle = {
        alignItems: "center",
        justifyItems: "center",
        paddingLeft: "0.5rem",
        paddingRight: "0.5rem",
        borderRight: "1px solid var(--ls-border-color)"
    };
    return (
        <div
            style={{
                borderBottom: "1px solid var(--ls-border-color)",
                alignItems: "center",
                justifyContent: "end",
                flexShrink: 0
            }}
            className="highlight-mask-editor-toolbar flex">
            <span className={selected ? "flex" : "hidden"} style={groupStyle}>
                <LogseqSelect
                    value={clozeId}
                    onChange={onClozeIdChange}
                    options={_.range(1, 10).map((i) => ({value: i, label: String(i)}))}
                    title="Cloze Id:"
                    size="sm"
                    width="80px"
                />
                {selected && (
                    <LogseqButton
                        color={hint ? "primary" : "secondary"}
                        size="sm"
                        title={hint ? `Hint: ${hint}` : "Set Hint"}
                        onClick={onHint}
                        icon={HINT_ICON}
                    />
                )}
            </span>
            <span style={groupStyle}>
                <LogseqPopover
                    placement="bottom-end"
                    content={
                        <div
                            style={{
                                boxShadow:
                                    "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                                borderRadius: "0.25rem",
                                overflow: "hidden",
                                margin: 0,
                                padding: "10px",
                                backgroundColor: "var(--ls-primary-background-color)",
                                width: "240px"
                            }}>
                            <LogseqCheckbox
                                checked={tags.includes("hide-all-test-one")}
                                onChange={(e) =>
                                    setTags(
                                        e.target.checked
                                            ? [...tags, "hide-all-test-one"]
                                            : tags.filter((tag) => tag !== "hide-all-test-one")
                                    )
                                }>
                                Hide All, Test One (
                                <LogseqTooltip content="When enabled, hides all highlights including the one being tested during anki review.">
                                    ?
                                </LogseqTooltip>
                                )
                            </LogseqCheckbox>
                        </div>
                    }>
                    <LogseqButton color="default" size="sm" icon={SETTINGS_ICON} />
                </LogseqPopover>
            </span>
            <span style={{paddingLeft: "0.5rem"}} />
            <LogseqButton
                color="success"
                size="sm"
                isFullWidth={false}
                title="Add Highlight (Select text first)"
                onClick={onAdd}
                icon={ADD_ICON}
                disabled={!hasTextSelection || selected}
            />
            <LogseqButton
                color="failed"
                size="sm"
                isFullWidth={false}
                title="Delete Highlight"
                onClick={onDelete}
                icon={REMOVE_ICON}
                disabled={!selected}
            />
        </div>
    );
}
