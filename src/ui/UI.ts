import './styles/main.css';
import React from './React';
import ReactDOM from './ReactDOM';
import {LogseqProxy} from "../logseq/LogseqProxy";
import { waitForElement } from './utils/waitForElement';
import { WindowParentBridge } from "../logseq/WindowParentBridge";

import { createLogger, LoggerCategory } from "../utils/logger";

const logger = createLogger(LoggerCategory.Others);

export class UI {
    private static appRoot: HTMLElement | null = null;
    private static isVisible: boolean = false;

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
    }

    private static async loadThemeVariables() {
        const props = [
            '--ls-primary-background-color',
            '--ls-secondary-background-color',
            '--ls-tertiary-background-color',
            '--ls-quaternary-background-color',
            '--ls-active-primary-color',
            '--ls-active-secondary-color',
            '--ls-border-color',
            '--ls-secondary-border-color',
            '--ls-tertiary-border-color',
            '--ls-primary-text-color',
            '--ls-secondary-text-color',
            '--ls-block-highlight-color',
            '--ls-block-bullet-border-color',
            '--ls-block-bullet-color',
            '--ls-guideline-color',
            '--ls-menu-hover-color',
            '--ls-primary-text-opacity',
            '--ls-secondary-text-opacity',
            '--ls-title-text-color',
            '--ls-link-text-color',
            '--ls-link-text-hover-color',
            '--ls-link-ref-text-color',
            '--ls-link-ref-text-hover-color',
            '--ls-tag-text-color',
            '--ls-tag-text-hover-color',
            '--ls-slide-background-color',
            '--ls-block-properties-background-color',
            '--ls-page-properties-background-color',
            '--ls-page-blockquote-color',
            '--ls-page-blockquote-bg-color',
            '--ls-page-blockquote-border-color',
            '--ls-page-inline-code-color',
            '--ls-page-inline-code-bg-color',
            '--ls-scrollbar-foreground-color',
            '--ls-scrollbar-background-color',
            '--ls-scrollbar-thumb-hover-color',
            '--ls-head-text-color',
            '--ls-cloze-text-color',
            '--ls-icon-color',
            '--ls-search-background-color',
            '--ls-search-icon-color',
            '--ls-a-chosen-bg',
            '--ls-right-sidebar-code-bg-color',
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

    public static async showModal(component: React.ReactElement, position?: { left: number; top: number }) {
        try {
            // Get app root
            this.appRoot = document.getElementById('app');
            if (!this.appRoot) {
                throw new Error('App root element not found');
            }

            // Clear any previous positioning
            this.appRoot.style.position = '';
            this.appRoot.style.left = '';
            this.appRoot.style.top = '';
            this.appRoot.style.transform = '';

            // Render component
            ReactDOM.render(component, this.appRoot);

            // Show the UI
            logseq.showMainUI();

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
            // Hide the UI
            logseq.hideMainUI({ restoreEditingCursor: true });
            
            // Unmount React component
            if (this.appRoot) {
                ReactDOM.unmountComponentAtNode(this.appRoot);
            }
        } catch (error) {
            logger.error('Failed to hide modal:', error);
        }
    }

    public static async getCursorPosition(): Promise<{ left: number; top: number; rect: any } | null> {
        try {
            const pos = await logseq.Editor.getEditingCursorPosition();
            return pos || null;
        } catch (error) {
            logger.warn('Failed to get cursor position:', error);
            return null;
        }
    }

    public static async getEventHandlersForMountedReactComponent(key: string) {
        let onClose = async () => {
            try {
                const div = WindowParentBridge.getElementById(key);
                if (!div) return;
                ReactDOM.unmountComponentAtNode(div);
                logseq.provideUI({
                    key: key,
                    path: "#root main",
                    template: "",
                    reset: true,
                    replace: true,
                    close: "outside"
                });
                div.remove();
            } catch (e) {
                logger.info(e);
            }
        };

        return {key, onClose};
    }

    public static async mountReactComponentInLogseq(key: string, path: string, component: React.ReactElement) {
        // Random key to avoid conflicts
        logseq.provideUI({
            key: key,
            path: path,
            close: "outside",
            template: `<div id="${key}"></div>`
        });

        // Wait for the element to be mounted
        await waitForElement(`//div[@id='${key}']`, 10000, WindowParentBridge.getDocument());
        const { onClose } = await this.getEventHandlersForMountedReactComponent(key);
        LogseqProxy.App.registerPluginUnloadListener(onClose);

        ReactDOM.render(component, WindowParentBridge.getElementById(key));
    }
}
