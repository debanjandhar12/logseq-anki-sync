import type * as ReactDOMTypes from 'react-dom';

const ReactDOM = logseq.Experiments.ReactDOM as typeof ReactDOMTypes;

export default ReactDOM;

export const render = ReactDOM.render;
export const unmountComponentAtNode = ReactDOM.unmountComponentAtNode;
export const findDOMNode = ReactDOM.findDOMNode;
export const createPortal = ReactDOM.createPortal;

export type {
    Renderer
} from 'react-dom';