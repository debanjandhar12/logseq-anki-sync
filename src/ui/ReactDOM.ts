import type * as ReactDOMTypes from "react-dom";
import * as OriginalReactDOM from "react-dom";
import {LogseqAppInfoFetcher} from "../logseq/LogseqAppInfoFetcher";

const ReactDOM = ((process.env.NODE_ENV === "production" &&
        LogseqAppInfoFetcher.checkHostAccess(window.parent) &&
        typeof logseq !== "undefined" &&
        logseq?.Experiments?.ReactDOM as typeof ReactDOMTypes) ||
        OriginalReactDOM);

export default ReactDOM;

export const render = ReactDOM.render;
export const unmountComponentAtNode = ReactDOM.unmountComponentAtNode;
export const findDOMNode = ReactDOM.findDOMNode;
export const createPortal = ReactDOM.createPortal;

export type {Renderer} from "react-dom";
