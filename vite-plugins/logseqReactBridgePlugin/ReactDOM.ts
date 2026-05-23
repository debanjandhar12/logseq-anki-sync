import type * as ReactDOMTypes from "react-dom";
import * as OriginalReactDOM from "react-dom";
import type * as ReactDOMClientTypes from "react-dom/client";
import * as OriginalReactDOMClient from "react-dom/client";
import "@logseq/libs";
import {LogseqAppInfoFetcher} from "../../src/logseq/LogseqAppInfoFetcher";


type CombinedReactDOM = typeof ReactDOMTypes & {
    createRoot: typeof ReactDOMClientTypes.createRoot;
    hydrateRoot: typeof ReactDOMClientTypes.hydrateRoot;
};

function getReactDOMInstance(): CombinedReactDOM {
    if (process.env.NODE_ENV === "production" &&
        LogseqAppInfoFetcher.checkHostAccess() &&
        typeof logseq !== "undefined" &&
        logseq?.Experiments?.ReactDOM?.["createRoot"]) {
        return logseq.Experiments.ReactDOM as CombinedReactDOM;
    }
    return {
        ...OriginalReactDOM,
        ...OriginalReactDOMClient
    } as CombinedReactDOM;
}

const ReactDOM = getReactDOMInstance();

export default ReactDOM;

export const createRoot = ReactDOM.createRoot;
export const createPortal = ReactDOM.createPortal;
export const flushSync = ReactDOM.flushSync;

export const findDOMNode = ReactDOM.findDOMNode;
export const hydrate = ReactDOM.hydrate;
export const hydrateRoot = ReactDOM.hydrateRoot;
export const render = ReactDOM.render;
export const unmountComponentAtNode = ReactDOM.unmountComponentAtNode;
export const unstable_batchedUpdates = ReactDOM.unstable_batchedUpdates;
export const unstable_renderSubtreeIntoContainer = ReactDOM.unstable_renderSubtreeIntoContainer;
export const version = ReactDOM.version;
// biome-ignore lint/suspicious/noExplicitAny: ReactDOM internals needed for compatibility
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = (ReactDOM as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

export type {Renderer} from "react-dom";
export type {Root} from "react-dom/client";
