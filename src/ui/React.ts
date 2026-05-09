import type * as ReactTypes from "react";
import * as OriginalReact from "react";
import {LogseqAppInfoFetcher} from "../logseq/LogseqAppInfoFetcher";

const React = ((process.env.NODE_ENV === "production" &&
    LogseqAppInfoFetcher.checkHostAccess(window.parent) &&
    typeof logseq !== "undefined" &&
    logseq?.Experiments?.ReactDOM["createRoot"] &&
    logseq?.Experiments?.React) as typeof ReactTypes) || OriginalReact;

export default React;

export const useState = React.useState;
export const useEffect = React.useEffect;
export const useCallback = React.useCallback;
export const useMemo = React.useMemo;
export const useRef = React.useRef;
export const useContext = React.useContext;
export const useReducer = React.useReducer;
export const useLayoutEffect = React.useLayoutEffect;
export const useImperativeHandle = React.useImperativeHandle;
export const useDebugValue = React.useDebugValue;

export const Component = React.Component;
export const PureComponent = React.PureComponent;
export const Fragment = React.Fragment;
export const StrictMode = React.StrictMode;
export const Suspense = React.Suspense;
export const createElement = React.createElement;
export const cloneElement = React.cloneElement;
export const createContext = React.createContext;
export const forwardRef = React.forwardRef;
export const memo = React.memo;

export type {
    ComponentProps,
    ComponentPropsWithoutRef,
    ComponentPropsWithRef,
    ComponentType,
    Consumer,
    Context,
    CSSProperties,
    DependencyList,
    Dispatch,
    EffectCallback,
    FC,
    FunctionComponent,
    HTMLAttributes,
    Key,
    MutableRefObject,
    PropsWithChildren,
    Provider,
    ReactChild,
    ReactChildren,
    ReactElement,
    ReactNode,
    Ref,
    RefObject,
    SetStateAction
} from "react";
