import type * as ReactDOMTypes from 'react-dom';
import * as OriginalReactDOM from "react-dom";

const ReactDOM = ((process.env.NODE_ENV === 'production' &&
        typeof logseq !== 'undefined' && logseq?.Experiments?.ReactDOM)
    || OriginalReactDOM) as typeof ReactDOMTypes;

export default ReactDOM;

export const render = ReactDOM.render;
export const unmountComponentAtNode = ReactDOM.unmountComponentAtNode;
export const findDOMNode = ReactDOM.findDOMNode;
export const createPortal = ReactDOM.createPortal;

export type {
    Renderer
} from 'react-dom';