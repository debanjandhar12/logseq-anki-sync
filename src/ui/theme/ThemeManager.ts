import {createLogger, LoggerCategory} from "../../logger";
import {WindowBridge} from "../../logseq/WindowBridge";
import {LOGSEQ_THEME_VARIABLES} from "./constants";

const logger = createLogger(LoggerCategory.OTHER_UI);

/**
 * ThemeManager - Centralized theme variable management
 *
 * Provides utilities to fetch Logseq theme variables and apply them to different contexts:
 * - Iframe body (for main UI)
 * - Shadow DOM root (for sidebar)
 */
export class ThemeManager {
    /**
     * Fetch theme variables from Logseq
     * @returns Promise resolving to theme variable values or null if unavailable
     */
    private static async fetchThemeVariables(): Promise<Record<string, string> | null> {
        try {
            // @ts-ignore - logseq.UI.resolveThemeCssPropsVals is not in types
            const vals = await logseq.UI.resolveThemeCssPropsVals(LOGSEQ_THEME_VARIABLES);
            if (!vals) {
                logger.warn("Theme variables not available, using defaults");
                return null;
            }
            return vals as Record<string, string>;
        } catch (error) {
            logger.error("Failed to fetch theme variables:", error);
            return null;
        }
    }

    /**
     * Apply theme variables to the iframe body element
     * Used by UI.ts for the main UI (iframe context)
     */
    public static async applyThemeToBody(): Promise<void> {
        const vals = await ThemeManager.fetchThemeVariables();
        if (!vals) {
            return;
        }

        const style = WindowBridge.getBody().style;
        Object.entries(vals).forEach(([k, v]) => {
            style.setProperty(k, v);
        });
    }

    /**
     * Get theme variables as a CSS string for Shadow DOM
     * Returns a formatted string like: ":host { --var: value; ... }"
     * Used by ShadowWrapper for sidebar context
     */
    public static async getThemeVariablesCssString(): Promise<string> {
        const vals = await ThemeManager.fetchThemeVariables();
        if (!vals) {
            return "";
        }

        const cssVars = Object.entries(vals)
            .map(([key, value]) => `${key}: ${value};`)
            .join("\n  ");

        return `:host {\n  ${cssVars}\n}`;
    }
}
