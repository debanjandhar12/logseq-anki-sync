import './styles/main.css';
import ReactDOM from './ReactDOM';
import {LogseqProxy} from "../logseq/LogseqProxy";
import { waitForElement } from './utils/waitForElement';
import { WindowParentBridge } from "../logseq/WindowParentBridge";

import { createLogger, LoggerCategory } from "../utils/logger";

const logger = createLogger(LoggerCategory.Others);

export class UI {
    private static appRoot: HTMLElement | null = null;
    private static isVisible: boolean = false;
    private static openModalCount: number = 0;
    private static currentModalComponent: React.ReactElement | null = null;

    public static init() {
        this.loadThemeVariables();// Initialize theme variables
        
        // Listen for theme changes
        logseq.App.onThemeChanged(() => {
            setTimeout(() => this.loadThemeVariables(), 100);
        });
        
        // Listen for visibility changes
        logseq.on('ui:visible:changed', ({ visible }) => {
            this.isVisible = visible;
            if (visible) {
                this.loadThemeVariables();
            }
        });

        // Listen for HMR updates to re-render current modal
        // @ts-ignore - Vite will replace this
        if (import.meta && import.meta.hot) {
            // @ts-ignore - Vite will replace this
            import.meta.hot.accept(() => {
                if (this.currentModalComponent && this.openModalCount > 0 && this.appRoot) {
                    // Re-render the current modal with the updated component
                    ReactDOM.render(this.currentModalComponent, this.appRoot);
                }
            });
        }
    }

    private static async loadThemeVariables() {
        // Core theme variables used by Tailwind (see tailwind.config.js)
        const props = [
            // Background colors
            '--ls-primary-background-color',
            '--ls-secondary-background-color',
            '--ls-tertiary-background-color',
            '--ls-quaternary-background-color',
            
            // Primary colors
            '--ls-button-background',
            '--secondary',
            '--tertiary',
            '--primary',
            '--radius',
            
            // Border colors
            '--ls-border-color',
            '--ls-secondary-border-color',
            '--ls-tertiary-border-color',
            
            // Text colors
            '--ls-primary-text-color',
            '--ls-secondary-text-color',
            
            // Block/UI colors
            '--ls-block-highlight-color',
            '--ls-block-bullet-border-color',
            '--ls-block-bullet-color',
            '--ls-guideline-color',
            '--ls-menu-hover-color',
            
            // Opacity
            '--ls-primary-text-opacity',
            '--ls-secondary-text-opacity',
            
            // Semantic text colors
            '--ls-title-text-color',
            '--ls-link-text-color',
            '--ls-link-text-hover-color',
            '--ls-link-ref-text-color',
            '--ls-link-ref-text-hover-color',
            '--ls-tag-text-color',
            '--ls-tag-text-hover-color',
            
            // Component-specific colors
            '--ls-slide-background-color',
            '--ls-block-properties-background-color',
            '--ls-page-properties-background-color',
            '--ls-page-blockquote-color',
            '--ls-page-blockquote-bg-color',
            '--ls-page-blockquote-border-color',
            '--ls-page-inline-code-color',
            '--ls-page-inline-code-bg-color',
            
            // Scrollbar
            '--ls-scrollbar-foreground-color',
            '--ls-scrollbar-background-color',
            '--ls-scrollbar-thumb-hover-color',
            '--ls-scrollbar-width',
            
            // Misc
            '--ls-head-text-color',
            '--ls-cloze-text-color',
            '--ls-icon-color',
            '--ls-search-background-color',
            '--ls-search-icon-color',
            '--ls-a-chosen-bg',
            '--ls-right-sidebar-code-bg-color',
            
            // Level colors
            '--color-level-1',
            '--color-level-2',
            '--color-level-3',
            '--color-level-4',
            '--color-level-5',
            '--color-level-6'
        ];

        try {
            // @ts-ignore - logseq.UI.resolveThemeCssPropsVals is not in types
            const vals = await logseq.UI.resolveThemeCssPropsVals(props);
            if (!vals) {
                logger.warn('Theme variables not available, using defaults');
                return;
            }
            
            const style = document.body.style;
            Object.entries(vals).forEach(([k, v]) => {
                style.setProperty(k, v as string);
            });
        } catch (error) {
            logger.error('Failed to load theme variables:', error);
            // Fallback to CSS defaults defined in main.css
        }
    }

    public static async showModal(component: React.ReactElement) {
        try {
            // Get app root
            this.appRoot = document.getElementById('app');
            if (!this.appRoot) {
                throw new Error('App root element not found');
            }

            // Store the current modal component for HMR
            this.currentModalComponent = component;

            // Render component
            ReactDOM.render(component, this.appRoot);

            // Increment modal count and show UI if this is the first modal
            this.openModalCount++;
            if (this.openModalCount === 1) {
                logseq.showMainUI();
            }

            // Verify UI is visible
            setTimeout(() => {
                if (!this.isVisible) {
                    logger.warn('UI may not be visible after showMainUI()');
                }
            }, 100);
        } catch (error) {
            logger.error('Failed to show modal:', error);
            logseq.UI.showMsg('Failed to show plugin UI. Please try again.', 'error');
            throw error;
        }
    }

    public static hideModal() {
        try {
            // Decrement modal count
            this.openModalCount = Math.max(0, this.openModalCount - 1);
            
            // Only hide UI if all modals are closed
            if (this.openModalCount === 0) {
                logseq.hideMainUI({ restoreEditingCursor: true });
                
                // Clear the current modal component reference
                this.currentModalComponent = null;
                
                // Unmount React component
                if (this.appRoot) {
                    ReactDOM.unmountComponentAtNode(this.appRoot);
                }
            }
        } catch (error) {
            logger.error('Failed to hide modal:', error);
        }
    }
}
