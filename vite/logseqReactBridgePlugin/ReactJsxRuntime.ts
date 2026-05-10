/**
 * JSX Runtime wrapper.
 *
 * assistant-ui uses the automatic JSX transform and imports from "react/jsx-runtime".
 * In dev mode, @vitejs/plugin-react uses "react/jsx-dev-runtime" (jsxDEV).
 * This wrapper re-exports from both so the aliasing chain works for both
 * "react/jsx-runtime" and "react/jsx-dev-runtime" imports.
 *
 * The logseqReactBridgePlugin excludes this file from interception, so the
 * imports below resolve to the real npm packages. Those packages internally
 * import "react" which IS intercepted to our React.ts wrapper — ensuring
 * the correct React instance is used.
 */
export {jsx, jsxs, Fragment} from "react/jsx-runtime";
export {jsxDEV} from "react/jsx-dev-runtime";
