import type * as ReactTypes from "react";
import * as OriginalReact from "react";
import "@logseq/libs";
import {LogseqAppInfoFetcher} from "../../src/logseq/LogseqAppInfoFetcher";

function getReactInstance(): typeof ReactTypes {
    if (process.env.NODE_ENV === "production" &&
        LogseqAppInfoFetcher.checkHostAccess() &&
        typeof logseq !== "undefined" &&
        logseq?.Experiments?.React) {
        return logseq.Experiments.React as typeof ReactTypes;
    }
    return OriginalReact;
}

const React = getReactInstance();

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
export const useSyncExternalStore = React.useSyncExternalStore;
export const useId = React.useId;
export const useTransition = React.useTransition;
export const useDeferredValue = React.useDeferredValue;
export const useInsertionEffect = React.useInsertionEffect;

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
export const isValidElement = React.isValidElement;
export const lazy = React.lazy;
export const startTransition = React.startTransition;

export const Children = React.Children;
export const Profiler = React.Profiler;
export const act = React.act;
export const createFactory = React.createFactory;
export const createRef = React.createRef;
export const version = React.version;
// biome-ignore lint/suspicious/noExplicitAny: React internals needed for react-dom compatibility
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

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
