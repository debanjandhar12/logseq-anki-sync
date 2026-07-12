import React, {useEffect, useLayoutEffect, useState} from "react";
import root from "react-shadow";
import {createLogger, LoggerCategory} from "../../logger";
// Import main.css as a raw string using Vite's ?inline feature
import mainCss from "../styles/main.css?inline";
import {ThemeManager} from "../theme/ThemeManager";
import {installReactPopperShadowDomCompatibilityPatch} from "./installReactPopperShadowDomCompatibilityPatch";
import {splitAtPropertyRules, useHoistCssPropertyRules} from "./useHoistCssPropertyRules";

const logger = createLogger(LoggerCategory.OTHER_UI);

// Split at module level since mainCss is a static build-time import
const {propertyRules, shadowCss} = splitAtPropertyRules(mainCss);

interface ShadowWrapperProps {
    children: React.ReactNode;
}

/**
 * ShadowWrapper - Provides CSS isolation for sidebar components
 *
 * Wraps children in a Shadow DOM to prevent CSS leaking to/from Logseq's UI.
 * Injects both the core CSS (main.css) and Logseq theme variables into the shadow root.
 *
 * Tailwind v4 `@property` rules are hoisted to the host document since they
 * only work at the document level and are ignored inside Shadow DOM.
 */
export const ShadowRootContext = React.createContext<HTMLDivElement | null>(null);

export const ShadowWrapper: React.FC<ShadowWrapperProps> = ({children}) => {
    const [host, setHost] = useState<HTMLElement | null>(null);
    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    const [isReactPopperCompatibilityInstalled, setIsReactPopperCompatibilityInstalled] =
        useState(false);

    useLayoutEffect(() => {
        if (!container) {
            setIsReactPopperCompatibilityInstalled(false);
            return;
        }

        const cleanup = installReactPopperShadowDomCompatibilityPatch({
            container,
            portalContainer: container
        });
        setIsReactPopperCompatibilityInstalled(true);

        return cleanup;
    }, [container]);

    useEffect(() => {
        if (!host) {
            return;
        }

        const stopKeyboardPropagation = (event: KeyboardEvent) => {
            event.stopPropagation();
        };

        host.addEventListener("keydown", stopKeyboardPropagation);
        host.addEventListener("keyup", stopKeyboardPropagation);
        host.addEventListener("keypress", stopKeyboardPropagation);

        return () => {
            host.removeEventListener("keydown", stopKeyboardPropagation);
            host.removeEventListener("keyup", stopKeyboardPropagation);
            host.removeEventListener("keypress", stopKeyboardPropagation);
        };
    }, [host]);

    useHoistCssPropertyRules(host, propertyRules);

    // Listen for theme changes from Logseq
    useEffect(() => {
        if (!container) {
            return;
        }

        const updateTheme = async () => {
            try {
                await ThemeManager.applyThemeToBody(container);
            } catch (error) {
                logger.error("Failed to fetch theme state:", error);
            }
        };

        updateTheme();
        const unsubscribe = logseq.App.onThemeChanged(() => {
            setTimeout(updateTheme, 100);
        });
        const unsubscribe2 = logseq.App.onThemeModeChanged(() => {
            setTimeout(updateTheme, 100);
        });
        return () => {
            unsubscribe();
            unsubscribe2();
        };
    }, [container]);

    return (
        <root.div ref={setHost} mode="open">
            <style>{shadowCss}</style>
            <div
                ref={setContainer}
                style={{height: "100%", width: "100%", transform: "translate(0, 0)"}}>
                <ShadowRootContext.Provider value={container}>
                    {isReactPopperCompatibilityInstalled ? children : null}
                </ShadowRootContext.Provider>
            </div>
        </root.div>
    );
};
