import type {BlockPropertiesRendererProps} from "@logseq/libs/dist/modules/LSPlugin.Experiments";
import * as React from "react";
import {createPortal} from "react-dom";
import {createLogger, LoggerCategory} from "../../logger";
import {LogseqAppInfoFetcher} from "../../logseq/LogseqAppInfoFetcher";
import {LogseqProxy} from "../../logseq/LogseqProxy";
import {WindowParentBridge} from "../../logseq/WindowParentBridge";
import {OcclusionPropertyRenderer} from "./OcclusionPropertyRenderer";
import {normalizeRendererProperties} from "./utils/normalizeRendererProperties";

const logger = createLogger(LoggerCategory.Others);

export function registerRenderer(isEnabled: () => boolean): () => void {
    let disposed = false;
    let unregisterRenderer: (() => void) | undefined;
    let unregisterUnload: (() => void) | undefined;
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        try {
            unregisterRenderer?.();
        } finally {
            unregisterRenderer = undefined;
            unregisterUnload?.();
            unregisterUnload = undefined;
        }
    };
    unregisterUnload = LogseqProxy.App.registerPluginUnloadListener(() => {
        // Do not splice the live array while the unload dispatcher is iterating it.
        unregisterUnload = undefined;
        dispose();
    });

    const register = async () => {
        if (!LogseqAppInfoFetcher.checkHostAccess()) return;
        if (!(await LogseqAppInfoFetcher.checkCurrentIsDbGraph()) || disposed || !isEnabled())
            return;
        const experiments = logseq.Experiments;
        if (typeof experiments?.registerBlockPropertiesRenderer !== "function") return;
        const hostReact = experiments.React as typeof React | undefined;
        const hostReactDOM = experiments.ReactDOM as
            | {createPortal?: typeof createPortal}
            | undefined;
        // A host-mounted component must not use the bridge's bundled fallback.
        if (
            hostReact?.createElement !== React.createElement ||
            hostReact?.useState !== React.useState ||
            hostReact?.useRef !== React.useRef ||
            hostReact?.useEffect !== React.useEffect ||
            hostReactDOM?.createPortal !== createPortal ||
            typeof WindowParentBridge.getGlobalObject("MutationObserver") !== "function"
        )
            return;
        const unregister = experiments.registerBlockPropertiesRenderer(
            `${logseq.baseInfo.id}-occlusion-prop-renderer`,
            {
                mode: "append",
                when: ({properties}) =>
                    !disposed &&
                    isEnabled() &&
                    Object.hasOwn(normalizeRendererProperties(properties), "occlusion"),
                render: (props: BlockPropertiesRendererProps) =>
                    !disposed &&
                    isEnabled() &&
                    Object.hasOwn(normalizeRendererProperties(props.properties), "occlusion")
                        ? React.createElement(OcclusionPropertyRenderer, props)
                        : null
            }
        );
        if (typeof unregister === "function") {
            if (disposed) unregister();
            else unregisterRenderer = unregister;
        }
    };
    void register().catch((error) =>
        logger.warn(
            "Could not register the occlusion property renderer; keeping CSS fallback.",
            error
        )
    );
    return dispose;
}
