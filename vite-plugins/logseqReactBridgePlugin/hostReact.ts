import "@logseq/libs";
import {version as bundledReactVersion} from "react/package.json";
import {LogseqAppInfoFetcher} from "../../src/logseq/LogseqAppInfoFetcher";

/** Older file-graph hosts may expose React 18; never mix it with the React 19 JSX runtime. */
export function getHostReact() {
    if (!LogseqAppInfoFetcher.checkHostAccess() || typeof logseq === "undefined") {
        return null;
    }
    const React = logseq.Experiments?.React as {version?: string} | undefined;
    const ReactDOM = logseq.Experiments?.ReactDOM as
        | {version?: string; createRoot?: unknown; createPortal?: unknown}
        | undefined;
    if (
        !React?.version?.startsWith("19.") ||
        React.version !== ReactDOM?.version ||
        typeof ReactDOM?.createPortal !== "function" ||
        // Logseq may expose react-dom without react-dom/client. In that case our bundled
        // client renderer can use host React, but only with the exact same React version.
        (typeof ReactDOM?.createRoot !== "function" && React.version !== bundledReactVersion)
    ) {
        return null;
    }
    return {React, ReactDOM};
}
