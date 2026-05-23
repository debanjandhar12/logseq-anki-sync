import React, {useEffect, useState} from "react";
import root from "react-shadow";
import {createLogger, LoggerCategory} from "../logger";
// Import main.css as a raw string using Vite's ?inline feature
import mainCss from "./styles/main.css?inline";

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
    const [isDark, setIsDark] = useState<boolean>(false);

    // Listen for theme changes from Logseq
    useEffect(() => {
        const updateTheme = async () => {
            try {
                // Determine if Logseq is in dark mode
                const theme = await logseq.App.getStateFromStore<"dark" | "light">("ui/theme");
                setIsDark(theme === "dark");
            } catch (error) {
                logger.error("Failed to fetch theme state:", error);
            }
        };

        updateTheme();

        const unsubscribe = logseq.App.onThemeChanged(() => {
            logger.debug("Theme changed, updating shadow DOM classes");
            updateTheme();
        });

        return () => {
            unsubscribe();
        };
    }, []);

    return (
        <root.div>
            <style>{mainCss}</style>
            <div
                ref={setContainer}
                className={isDark ? "dark" : "light"}
                style={{height: "100%", width: "100%", transform: "translate(0, 0)"}}>
                <ShadowRootContext.Provider value={container}>
                    {children}
                </ShadowRootContext.Provider>
            </div>
        </root.div>
    );
};
