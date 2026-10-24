import {type RefObject, useEffect, useState} from "react";
import {WindowParentBridge} from "../../../logseq/WindowParentBridge";
import {findOcclusionValueTargets} from "../utils/findOcclusionValueTargets";

export function useOcclusionValueTargets(anchor: RefObject<HTMLElement | null>): HTMLElement[] {
    const [targets, setTargets] = useState<HTMLElement[]>([]);

    useEffect(() => {
        const element = anchor.current;
        const area = element?.closest(".ls-properties-area");
        const Observer =
            WindowParentBridge.getGlobalObject<typeof MutationObserver>("MutationObserver");
        if (!area || !Observer) return;

        const updateTargets = () => {
            const next = findOcclusionValueTargets(element);
            setTargets((previous) =>
                previous.length === next.length &&
                previous.every((target, index) => target === next[index])
                    ? previous
                    : next
            );
        };
        // Logseq can replace or expand native property rows without remounting our renderer.
        const observer = new Observer(updateTargets);
        observer.observe(area, {childList: true, subtree: true});
        updateTargets();
        return () => observer.disconnect();
    }, [anchor]);

    return targets;
}
