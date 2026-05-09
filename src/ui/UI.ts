import "./styles/main.css";

import {createLogger, LoggerCategory} from "../logger";
import {LogseqProxy} from "../logseq/LogseqProxy";
import {WindowBridge} from "../logseq/WindowBridge";
import {createRoot, type Root} from "./ReactDOM";

const logger = createLogger(LoggerCategory.UI);

interface ModalStackEntry {
    id: string;
    component: React.ReactElement;
    containerElement: HTMLElement;
    root: Root;
}

/**
 * UI Manager for Logseq Anki Sync Plugin
 *
 * Manages modal display with proper stacking support. Multiple modals can be open
 * simultaneously, each in its own container with proper z-index layering.
 *
 * **Modal Stack Architecture:**
 * - Each modal gets a unique ID and dedicated DOM container
 * - Modals stack with increasing z-index (1000, 1010, 1020, etc.)
 *
 */
export class UI {
    private static appRoot: HTMLElement | null = null;

    private static get isVisible(): boolean {
        return (WindowBridge.getWindow() as any).__UI_IS_VISIBLE__ === true;
    }
    private static set isVisible(value: boolean) {
        (WindowBridge.getWindow() as any).__UI_IS_VISIBLE__ = value;
    }

    private static get modalStack(): ModalStackEntry[] {
        if (!(WindowBridge.getWindow() as any).__UI_MODAL_STACK__) {
            (WindowBridge.getWindow() as any).__UI_MODAL_STACK__ = [];
        }
        return (WindowBridge.getWindow() as any).__UI_MODAL_STACK__;
    }
    private static set modalStack(value: ModalStackEntry[]) {
        (WindowBridge.getWindow() as any).__UI_MODAL_STACK__ = value;
    }

    public static get modalIdCounter(): number {
        return (WindowBridge.getWindow() as any).__UI_MODAL_ID_COUNTER__ || 0;
    }
    public static set modalIdCounter(value: number) {
        (WindowBridge.getWindow() as any).__UI_MODAL_ID_COUNTER__ = value;
    }

    /**
     * Reset UI state - useful for testing
     * @internal
     */
    public static _resetForTesting() {
        // Clean up modals without triggering logseq.hideMainUI
        UI.modalStack.forEach((entry) => {
            entry.root.unmount();
            if (entry.containerElement.parentNode) {
                entry.containerElement.parentNode.removeChild(entry.containerElement);
            }
        });
        UI.modalStack = [];
        UI.modalIdCounter = 0;
        UI.isVisible = false;
        UI.appRoot = null;
    }

    public static init() {
        logseq.hideMainUI({restoreEditingCursor: true}); // Hide main ui on plugin load
        UI.loadThemeVariables(); // Initialize theme variables

        // Listen for theme changes
        logseq.App.onThemeChanged(() => {
            setTimeout(() => UI.loadThemeVariables(), 100);
        });

        // Listen for visibility changes
        logseq.on("ui:visible:changed", ({visible}) => {
            UI.isVisible = visible;
            if (visible) {
                UI.loadThemeVariables();
            }
        });

        // Hide main ui on plugin unload
        LogseqProxy.App.registerPluginUnloadListener(() => {
            logseq.hideMainUI({restoreEditingCursor: true});
        });
    }

    private static async loadThemeVariables() {
        // Core theme variables used by Tailwind (see tailwind.config.js)
        const props = [
            // Background colors
            "--ls-primary-background-color",
            "--ls-secondary-background-color",
            "--ls-tertiary-background-color",
            "--ls-quaternary-background-color",

            // Primary colors
            "--ls-button-background",
            "--secondary",
            "--tertiary",
            "--primary",
            "--radius",

            // Border colors
            "--ls-border-color",
            "--ls-secondary-border-color",
            "--ls-tertiary-border-color",

            // Text colors
            "--ls-primary-text-color",
            "--ls-secondary-text-color",

            // Block/UI colors
            "--ls-block-highlight-color",
            "--ls-block-bullet-border-color",
            "--ls-block-bullet-color",
            "--ls-guideline-color",
            "--ls-menu-hover-color",

            // Opacity
            "--ls-primary-text-opacity",
            "--ls-secondary-text-opacity",

            // Semantic text colors
            "--ls-title-text-color",
            "--ls-link-text-color",
            "--ls-link-text-hover-color",
            "--ls-link-ref-text-color",
            "--ls-link-ref-text-hover-color",
            "--ls-tag-text-color",
            "--ls-tag-text-hover-color",

            // Component-specific colors
            "--ls-slide-background-color",
            "--ls-block-properties-background-color",
            "--ls-page-properties-background-color",
            "--ls-page-blockquote-color",
            "--ls-page-blockquote-bg-color",
            "--ls-page-blockquote-border-color",
            "--ls-page-inline-code-color",
            "--ls-page-inline-code-bg-color",

            // Scrollbar
            "--ls-scrollbar-foreground-color",
            "--ls-scrollbar-background-color",
            "--ls-scrollbar-thumb-hover-color",
            "--ls-scrollbar-width",
            "--lx-gray-02",
            "--lx-gray-05",
            "--lx-gray-06",
            "--rx-gray-02",
            "--rx-gray-05",
            "--rx-gray-06",

            // Misc
            "--ls-head-text-color",
            "--ls-cloze-text-color",
            "--ls-icon-color",
            "--ls-search-background-color",
            "--ls-search-icon-color",
            "--ls-a-chosen-bg",
            "--ls-right-sidebar-code-bg-color",

            // Level colors
            "--color-level-1",
            "--color-level-2",
            "--color-level-3",
            "--color-level-4",
            "--color-level-5",
            "--color-level-6",

            // Gray colors for shortcut keys
            "--lx-gray-06-alpha",
            "--rx-gray-06-alpha",

            // Popover colors
            "--ls-popover-background-color",
            "--ls-popover-text-color"
        ];

        try {
            // @ts-ignore - logseq.UI.resolveThemeCssPropsVals is not in types
            const vals = await logseq.UI.resolveThemeCssPropsVals(props);
            if (!vals) {
                logger.warn("Theme variables not available, using defaults");
                return;
            }

            const style = WindowBridge.getBody().style;
            Object.entries(vals).forEach(([k, v]) => {
                style.setProperty(k, v as string);
            });
        } catch (error) {
            logger.error("Failed to load theme variables:", error);
            // Fallback to CSS defaults defined in main.css
        }
    }

    /**
     * Display a modal component
     *
     * Creates a dedicated container for the modal and adds it to the modal stack.
     * Multiple modals can be open simultaneously with proper z-index layering.
     *
     * @param component - React component to render as modal
     * @returns Promise resolving to unique modal ID
     * @throws Error if app root element is not found
     *
     * @example
     * ```typescript
     * const modalId = await UI.showModal(<MyModal />);
     * // Later, close this specific modal
     * UI.hideModal(modalId);
     * ```
     */
    public static async showModal(
        component: React.ReactElement,
        modalId?: string
    ): Promise<string> {
        try {
            // Get or create app root
            UI.appRoot = WindowBridge.getElementById("app");
            if (!UI.appRoot) {
                throw new Error("App root element not found");
            }

            // Generate unique modal ID (use provided one if available)
            const finalModalId = modalId || `modal-${++UI.modalIdCounter}`;

            // Create a container for this modal
            const containerElement = WindowBridge.createElement("div");
            containerElement.id = finalModalId;
            containerElement.style.position = "absolute";
            containerElement.style.inset = "0";
            containerElement.style.zIndex = String(1000 + UI.modalStack.length * 10);

            // Add container to app root
            UI.appRoot.appendChild(containerElement);

            // Render component in its container
            const root = createRoot(containerElement);
            root.render(component);

            // Add to modal stack
            const entry: ModalStackEntry = {
                id: finalModalId,
                component,
                containerElement,
                root
            };
            UI.modalStack.push(entry);

            // Show UI if this is the first modal
            if (UI.modalStack.length === 1) {
                logseq.showMainUI();
            }

            // Verify UI is visible
            setTimeout(() => {
                if (!UI.isVisible) {
                    logger.warn("UI may not be visible after showMainUI()");
                }
            }, 100);

            return finalModalId;
        } catch (error) {
            logger.error("Failed to show modal:", error);
            logseq.UI.showMsg("Failed to show plugin UI. Please try again.", "error");
            throw error;
        }
    }

    /**
     * Hide a modal
     *
     * If modalId is provided, removes that specific modal from the stack.
     * If modalId is omitted, removes the most recently opened modal (top of stack).
     *
     * The Logseq UI is hidden only when all modals are closed.
     *
     * @param modalId - Optional ID of specific modal to close
     *
     * @example
     * ```typescript
     * // Close most recent modal
     * UI.hideModal();
     *
     * // Close specific modal
     * UI.hideModal('modal-123');
     * ```
     */
    public static hideModal(modalId?: string) {
        try {
            if (UI.modalStack.length === 0) {
                logger.warn("hideModal called but modal stack is empty");
                return;
            }

            let entryToRemove: ModalStackEntry | undefined;

            if (modalId) {
                // Remove specific modal by ID
                const index = UI.modalStack.findIndex((entry) => entry.id === modalId);
                if (index === -1) {
                    logger.warn(`Modal with ID ${modalId} not found in stack`);
                    return;
                }
                entryToRemove = UI.modalStack[index];
                UI.modalStack.splice(index, 1);
            } else {
                // Remove the top modal (most recent)
                entryToRemove = UI.modalStack.pop();
            }

            if (entryToRemove) {
                // Unmount React component with defer
                const container = entryToRemove.containerElement;
                const root = entryToRemove.root;
                setTimeout(() => {
                    root.unmount();
                    if (container.parentNode) {
                        container.parentNode.removeChild(container);
                    }
                }, 0);
            }

            // Hide UI if all modals are closed
            if (UI.modalStack.length === 0) {
                logseq.hideMainUI({restoreEditingCursor: true});
            }
        } catch (error) {
            logger.error("Failed to hide modal:", error);
        }
    }

    /**
     * Get the number of currently open modals
     */
    public static getModalCount(): number {
        return UI.modalStack.length;
    }

    /**
     * Get the ID of the topmost (active) modal
     * @returns The active modal ID, or null if no modals are open
     */
    public static getActiveModal(): string | null {
        if (UI.modalStack.length === 0) {
            return null;
        }
        return UI.modalStack[UI.modalStack.length - 1].id;
    }

    /**
     * Close all modals at once
     */
    public static closeAllModals() {
        try {
            // Close modals in reverse order (top to bottom)
            while (UI.modalStack.length > 0) {
                UI.hideModal();
            }
        } catch (error) {
            logger.error("Failed to close all modals:", error);
        }
    }
}
