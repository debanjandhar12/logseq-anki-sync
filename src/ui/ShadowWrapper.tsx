import React, {useEffect, useState} from "react";
import root from "react-shadow";
import {createLogger, LoggerCategory} from "../logger";
// Import main.css as a raw string using Vite's ?inline feature
import mainCss from "./styles/main.css?inline";
import {ThemeManager} from "./theme/ThemeManager";

const logger = createLogger(LoggerCategory.OTHER_UI);

interface ShadowWrapperProps {
    children: React.ReactNode;
}

/**
 * ShadowWrapper - Provides CSS isolation for sidebar components
 *
 * Wraps children in a Shadow DOM to prevent CSS leaking to/from Logseq's UI.
 * Injects both the core CSS (main.css) and Logseq theme variables into the shadow root.
 */
export const ShadowRootContext = React.createContext<HTMLDivElement | null>(null);

export const ShadowWrapper: React.FC<ShadowWrapperProps> = ({children}) => {
    const [container, setContainer] = useState<HTMLDivElement | null>(null);

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
        <root.div>
            <style>{mainCss}</style>
            <div
                ref={setContainer}
                style={{height: "100%", width: "100%", transform: "translate(0, 0)"}}>
                <ShadowRootContext.Provider value={container}>
                    {children}
                </ShadowRootContext.Provider>
            </div>
        </root.div>
    );
};
