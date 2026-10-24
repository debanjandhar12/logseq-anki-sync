import type * as ReactDOMTypes from "react-dom";
import * as OriginalReactDOM from "react-dom";
import type * as ReactDOMClientTypes from "react-dom/client";
import * as OriginalReactDOMClient from "react-dom/client";
import {getHostReact} from "./hostReact";

type CombinedReactDOM = typeof ReactDOMTypes & {
    createRoot: typeof ReactDOMClientTypes.createRoot;
    hydrateRoot: typeof ReactDOMClientTypes.hydrateRoot;
};

const hostReactDOM = getHostReact()?.ReactDOM as CombinedReactDOM | undefined;
const ReactDOM = hostReactDOM
    ? {
          ...hostReactDOM,
          createRoot: hostReactDOM.createRoot ?? OriginalReactDOMClient.createRoot,
          hydrateRoot: hostReactDOM.hydrateRoot ?? OriginalReactDOMClient.hydrateRoot
      }
    : {...OriginalReactDOM, ...OriginalReactDOMClient};
const ReactDOMInternals = ReactDOM as any;
const OriginalReactDOMInternals = OriginalReactDOM as any;

export default ReactDOM;

export const createRoot = ReactDOM.createRoot;
export const createPortal = ReactDOM.createPortal;
export const flushSync = ReactDOM.flushSync;
export const hydrateRoot = ReactDOM.hydrateRoot;
export const unstable_batchedUpdates = ReactDOM.unstable_batchedUpdates;
export const version = ReactDOM.version;
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED =
    ReactDOMInternals.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED ??
    OriginalReactDOMInternals.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
export const __DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE =
    ReactDOMInternals.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ??
    OriginalReactDOMInternals.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

export type {Root} from "react-dom/client";
