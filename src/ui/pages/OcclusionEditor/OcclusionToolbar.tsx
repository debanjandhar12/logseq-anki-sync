import _ from "lodash";
import type {ChangeEvent, Dispatch, SetStateAction} from "react";
import HINT_ICON from "../../../../node_modules/@tabler/icons/icons/outline/bulb.svg?raw";
import SELECT_ICON from "../../../../node_modules/@tabler/icons/icons/outline/click.svg?raw";
import HAND_ICON from "../../../../node_modules/@tabler/icons/icons/outline/hand-stop.svg?raw";
import SETTINGS_ICON from "../../../../node_modules/@tabler/icons/icons/outline/settings.svg?raw";
import REMOVE_ICON from "../../../../node_modules/@tabler/icons/icons/outline/square-minus.svg?raw";
import ADD_ICON from "../../../../node_modules/@tabler/icons/icons/outline/square-plus-2.svg?raw";
import {LogseqButton} from "../../components/LogseqButton";
import {LogseqCheckbox} from "../../components/LogseqCheckbox";
import {LogseqPopover} from "../../components/LogseqPopover";
import {LogseqSelect} from "../../components/LogseqSelect";
import {LogseqTooltip} from "../../components/LogseqTooltip";
import type {ToolType} from "./types";

interface OcclusionToolbarProps {
    activeTool: ToolType;
    setActiveTool: (tool: ToolType) => void;
    zoomLevel: number;
    onZoomChange: (event: ChangeEvent<HTMLInputElement>) => void;
    selection: any[] | null;
    clozeId: string;
    onClozeIdChange: (value: string) => void;
    onHint: () => void;
    onAdd: () => void;
    onDelete: () => void;
    tags: string[];
    setTags: Dispatch<SetStateAction<string[]>>;
    generating: boolean;
    onGenerate: () => void;
}

export function OcclusionToolbar({
    activeTool,
    setActiveTool,
    zoomLevel,
    onZoomChange,
    selection,
    clozeId,
    onClozeIdChange,
    onHint,
    onAdd,
    onDelete,
    tags,
    setTags,
    generating,
    onGenerate
}: OcclusionToolbarProps) {
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
            className="occlusion-editor-toolbar flex">
            <span
                style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    paddingRight: "0.5rem",
                    borderRight: "1px solid var(--ls-border-color)"
                }}>
                <LogseqButton
                    color={activeTool === "select" ? "primary" : "ghost"}
                    size="sm"
                    title="Select Tool (Select and move occlusions)"
                    onClick={() => setActiveTool("select")}
                    icon={SELECT_ICON}
                />
                <LogseqButton
                    color={activeTool === "hand" ? "primary" : "ghost"}
                    size="sm"
                    title="Hand Tool (Pan/scroll the canvas)"
                    onClick={() => setActiveTool("hand")}
                    icon={HAND_ICON}
                />
            </span>
            <span style={{...groupStyle, display: "flex", flexDirection: "row", gap: "0.5rem"}}>
                <span className="text-sm opacity-80">Zoom:</span>
                <input
                    type="range"
                    min="5"
                    max="200"
                    value={zoomLevel}
                    onChange={onZoomChange}
                    style={{width: "100px"}}
                    className="zoom-slider"
                />
                <span className="text-sm opacity-80" style={{minWidth: "3rem"}}>
                    {zoomLevel}%
                </span>
            </span>
            <span
                className={selection && selection.length > 0 ? "flex" : "hidden"}
                style={groupStyle}>
                <LogseqSelect
                    value={clozeId}
                    onChange={onClozeIdChange}
                    options={_.range(1, 10).map((i) => ({value: i, label: String(i)}))}
                    title="Cloze Id:"
                    size="sm"
                    width="80px"
                />
                {selection?.length === 1 && (
                    <LogseqButton
                        color={selection[0].hint ? "primary" : "secondary"}
                        size="sm"
                        title={selection[0].hint ? `Hint: ${selection[0].hint}` : "Set Hint"}
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
                                <LogseqTooltip content="When enabled, hides all occlusions including the one being tested during anki review.">
                                    ?
                                </LogseqTooltip>
                                )
                            </LogseqCheckbox>
                            <hr style={{margin: "0.5rem"}} />
                            <div style={{marginLeft: "auto", marginRight: "auto"}}>
                                <LogseqButton
                                    color="primary"
                                    size="sm"
                                    title="Generate Occlusions using AI"
                                    onClick={onGenerate}
                                    disabled={generating}>
                                    {generating
                                        ? "Generating occlusions..."
                                        : "Generate Occlusions using AI"}
                                </LogseqButton>
                            </div>
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
                title="Add Occlusion"
                onClick={onAdd}
                icon={ADD_ICON}
            />
            <LogseqButton
                color="failed"
                size="sm"
                isFullWidth={false}
                title="Delete Occlusion"
                onClick={onDelete}
                icon={REMOVE_ICON}
                disabled={!selection?.length}
            />
        </div>
    );
}
