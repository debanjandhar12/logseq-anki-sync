import React, {useEffect, useRef, useState} from "react";
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
export const ShadowWrapper: React.FC<ShadowWrapperProps> = ({children}) => {
    const [themeVars, setThemeVars] = useState<string>("");
    const themeUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load theme variables on mount
    useEffect(() => {
        const loadTheme = async () => {
            const cssString = await ThemeManager.getThemeVariablesCssString();
            setThemeVars(cssString);
        };

        loadTheme();

        // Listen for theme changes from Logseq
        const unsubscribe = logseq.App.onThemeChanged(() => {
            // Debounce theme updates to avoid rapid re-renders
            if (themeUpdateTimeoutRef.current) {
                clearTimeout(themeUpdateTimeoutRef.current);
            }

            themeUpdateTimeoutRef.current = setTimeout(() => {
                logger.debug("Theme changed, updating shadow DOM");
                loadTheme();
            }, 100);
        });

        return () => {
            if (themeUpdateTimeoutRef.current) {
                clearTimeout(themeUpdateTimeoutRef.current);
            }
            unsubscribe();
        };
    }, []);

    return (
        <root.div>
            <style>{mainCss}</style>
            {themeVars && <style>{themeVars}</style>}
            {children}
        </root.div>
    );
};
