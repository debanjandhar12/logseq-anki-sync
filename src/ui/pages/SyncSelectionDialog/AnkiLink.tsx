import React from "react";
import {WindowParentBridge} from "../../../logseq/WindowParentBridge";
import {LogseqTooltip} from "../../components/LogseqTooltip";

export const AnkiLink = ({ankiId = null}: {ankiId?: number | null}) => {
    const normalStyle = {backgroundColor: "inherit", borderRadius: "2px"};
    const [style, setStyle] = React.useState(normalStyle);
    const children = ankiId == null ? "New note" : ankiId;
    return (
        <LogseqTooltip content={"Anki Note: " + children}>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: retain existing inline link behavior during structural refactor */}
            {/* biome-ignore lint/a11y/useKeyWithMouseEvents: hover styling only; keyboard behavior is unchanged */}
            <a
                // biome-ignore lint/a11y/useValidAnchor: invokes the host Anki browser rather than a URL
                onClick={(event) => {
                    if (ankiId != null)
                        WindowParentBridge.getAnkiConnect().guiBrowse(`nid:${ankiId}`);
                    event.preventDefault();
                    event.nativeEvent.stopImmediatePropagation();
                }}
                onMouseOver={() =>
                    setStyle({
                        backgroundColor: "var(--ls-secondary-border-color)",
                        borderRadius: "2px"
                    })
                }
                onMouseOut={() => setStyle(normalStyle)}
                className="inline-flex flex-row items-center button"
                style={{
                    ...style,
                    display: "inline-flex",
                    padding: 0,
                    height: "auto",
                    userSelect: "text",
                    cursor: "pointer"
                }}>
                <i className="anki-icon" />
                <span>{children}</span>
            </a>
        </LogseqTooltip>
    );
};
