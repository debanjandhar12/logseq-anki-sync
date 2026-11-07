import CHEVRON_UP_ICON from "@tabler/icons/outline/chevron-up.svg?raw";
import HELP_ICON from "@tabler/icons/outline/help.svg?raw";
import {useEffect, useState} from "react";
import {LogseqButton} from "../../components/LogseqButton";
import {LogseqCheckbox} from "../../components/LogseqCheckbox";
import {LogseqPopover} from "../../components/LogseqPopover";
import {LogseqTooltip} from "../../components/LogseqTooltip";
import {TablerIcon} from "../../components/TablerIcon";

export function SyncSettingsPopover() {
    const [skipOnHashMatch, setSkipOnHashMatch] = useState(true);
    useEffect(() => {
        logseq.updateSettings({skipOnDependencyHashMatch: true});
    }, []);
    useEffect(() => {
        logseq.updateSettings({skipOnDependencyHashMatch: skipOnHashMatch});
    }, [skipOnHashMatch]);
    return (
        <LogseqPopover
            placement="top-start"
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
                        width: "200px"
                    }}>
                    <LogseqCheckbox
                        checked={skipOnHashMatch}
                        onChange={() => setSkipOnHashMatch(!skipOnHashMatch)}>
                        Skip on hash match (
                        <LogseqTooltip content="When enabled, this will result in faster performance. However, sometimes this may lead to ignoring some changes.">
                            <TablerIcon icon={HELP_ICON} size={14} aria-hidden="true" />
                        </LogseqTooltip>
                        )
                    </LogseqCheckbox>
                </div>
            }>
            <LogseqButton color="outline-link" size="sm">
                <TablerIcon icon={CHEVRON_UP_ICON} aria-hidden="true" />
            </LogseqButton>
        </LogseqPopover>
    );
}
