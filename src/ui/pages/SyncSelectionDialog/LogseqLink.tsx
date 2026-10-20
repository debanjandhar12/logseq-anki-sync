import _ from "lodash";
import React from "react";
import {LogseqContentPreprocessor} from "../../../logseq/LogseqContentPreprocessor";
import {LogseqProxy} from "../../../logseq/LogseqProxy";
import {LogseqTooltip} from "../../components/LogseqTooltip";

export const LogseqLink = ({uuid}: {uuid: string; graphName: string}) => {
    const normalStyle = {backgroundColor: "inherit", borderRadius: "2px"};
    const [style, setStyle] = React.useState(normalStyle);
    const [displayText, setDisplayText] = React.useState(uuid);
    const [blockContent, setBlockContent] = React.useState<string | null>(null);
    React.useEffect(() => {
        const fetchBlockContent = async () => {
            try {
                const block = await LogseqProxy.Editor.getBlock(uuid);
                if (block?.content) {
                    const {content} = await LogseqContentPreprocessor.preprocess(
                        block.content,
                        block.format || "markdown"
                    );
                    setBlockContent(content);
                    setDisplayText(
                        _.truncate(content.replace(/\s+/g, " ").trim(), {
                            length: 34,
                            omission: "..."
                        })
                    );
                } else setDisplayText(uuid);
            } catch {
                setDisplayText(uuid);
            }
        };
        void fetchBlockContent();
    }, [uuid]);
    return (
        <LogseqTooltip
            content={
                blockContent
                    ? `Block UUID: ${uuid}\nContent: ${blockContent}`
                    : `Block UUID: ${uuid}`
            }>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: retain existing host navigation behavior */}
            {/* biome-ignore lint/a11y/useKeyWithMouseEvents: hover styling only; keyboard behavior is unchanged */}
            <a
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
                }}
                // biome-ignore lint/a11y/useValidAnchor: opens the Logseq sidebar rather than a browser URL
                onClick={(event) => {
                    if (uuid) {
                        logseq.Editor.openInRightSidebar(uuid);
                        logseq.UI.showMsg("Block opened in right sidebar.");
                        event.preventDefault();
                        event.nativeEvent.stopImmediatePropagation();
                    }
                }}>
                <i className="logseq-icon" />
                <span>{displayText}</span>
            </a>
        </LogseqTooltip>
    );
};
