import "@logseq/libs";
import {LogseqAppInfoFetcher} from "../../src/logseq/LogseqAppInfoFetcher";

/** Older file-graph hosts may expose React 18; never mix it with the React 19 JSX runtime. */
export function getHostReact() {
    if (!LogseqAppInfoFetcher.checkHostAccess() || typeof logseq === "undefined") {
        return null;
    }
    const React = logseq.Experiments?.React as {version?: string} | undefined;
    const ReactDOM = logseq.Experiments?.ReactDOM as
        | {version?: string; createRoot?: unknown}
        | undefined;
    if (
        !React?.version?.startsWith("19.") ||
        React.version !== ReactDOM?.version ||
        typeof ReactDOM?.createRoot !== "function"
    ) {
        return null;
    }
    return {React, ReactDOM};
}
