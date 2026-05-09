import type * as ReactDOMTypes from "react-dom";
import * as OriginalReactDOM from "react-dom";
import type * as ReactDOMClientTypes from "react-dom/client";
import * as OriginalReactDOMClient from "react-dom/client";
import {LogseqAppInfoFetcher} from "../logseq/LogseqAppInfoFetcher";

type CombinedReactDOM = typeof ReactDOMTypes & {
    createRoot: typeof ReactDOMClientTypes.createRoot;
};

const ReactDOM = (process.env.NODE_ENV === "production" &&
    LogseqAppInfoFetcher.checkHostAccess(window.parent) &&
    typeof logseq !== "undefined" &&
    logseq?.Experiments?.ReactDOM["createRoot"] &&
    (logseq?.Experiments?.ReactDOM as CombinedReactDOM)) || {
    ...OriginalReactDOM,
    ...OriginalReactDOMClient
};

export default ReactDOM;

export const createRoot = ReactDOM.createRoot;
export const createPortal = ReactDOM.createPortal;

export type {Renderer} from "react-dom";
export type {Root} from "react-dom/client";
