import "@logseq/libs";
import {LogseqAppInfoFetcher} from "./LogseqAppInfoFetcher";

/**
 * WindowParentBridge - Abstraction layer for communication with Logseq parent window
 */
export class WindowParentBridge {
    private static parentWindow: Window | null = null;
    private static initialized = false;

    /**
     * Initialize the WindowParentBridge with a parent window reference
     * @param parent - The parent window (defaults to window.parent)
     */
    static init(parent: Window = window.parent): void {
        WindowParentBridge.parentWindow = parent;
        WindowParentBridge.initialized = true;
    }

    /**
     * Check if WindowParentBridge has been initialized
     */
    static isInitialized(): boolean {
        return WindowParentBridge.initialized && WindowParentBridge.parentWindow !== null;
    }

    /**
     * Get the parent window instance
     * @throws Error if WindowParentBridge not initialized
     */
    private static getParentWindow(): Window {
        if (!WindowParentBridge.isInitialized()) {
            throw new Error(
                "WindowParentBridge not initialized. Call WindowParentBridge.init() first."
            );
        }
        return WindowParentBridge.parentWindow!;
    }

    /**
     * Get the internal Logseq API object from parent window
     * @throws Error if WindowParentBridge not initialized
     */
    static getInternalLogseqAPI(): typeof logseq {
        const parent = WindowParentBridge.getParentWindow();
        if (!(parent as any).logseq) {
            throw new Error("Logseq API not available on parent window");
        }
        return (parent as any).logseq;
    }

    /**
     * Get the parent document for DOM manipulation
     */
    static getDocument(): Document {
        return WindowParentBridge.getParentWindow().document;
    }

    /**
     * Dispatch a custom event on the parent window
     * @param eventName - Name of the event to dispatch
     * @param detail - Optional event detail data
     */
    static dispatchEvent(eventName: string, detail?: any): void {
        if (!WindowParentBridge.isInitialized()) return;

        const event = new CustomEvent(eventName, {detail});
        WindowParentBridge.parentWindow!.dispatchEvent(event);
    }

    /**
     * Get the LogseqAnkiSync global object for event dispatching
     */
    static getLogseqAnkiSync(): {dispatchEvent: (event: string) => void} {
        const parent = WindowParentBridge.getParentWindow();
        if (!(parent as any).LogseqAnkiSync) {
            throw new Error("LogseqAnkiSync not available on parent window");
        }
        return (parent as any).LogseqAnkiSync;
    }

    /**
     * Dispatch a LogseqAnkiSync event
     * @param eventName - Name of the event (e.g., 'syncLogseqToAnkiComplete')
     */
    static dispatchLogseqAnkiSyncEvent(eventName: string): void {
        const logseqAnkiSync = WindowParentBridge.getLogseqAnkiSync();
        logseqAnkiSync.dispatchEvent(eventName);
    }

    /**
     * Get the AnkiConnect global object
     */
    static getAnkiConnect(): any {
        const parent = WindowParentBridge.getParentWindow();
        if (!(parent as any).AnkiConnect) {
            throw new Error("AnkiConnect not available on parent window");
        }
        return (parent as any).AnkiConnect;
    }

    /**
     * Get the LSPluginCore for plugin management
     */
    static getLSPluginCore(): any {
        const parent = WindowParentBridge.getParentWindow();
        if (!(parent as any).LSPluginCore) {
            throw new Error("LSPluginCore not available on parent window");
        }
        return (parent as any).LSPluginCore;
    }

    /**
     * Make an asset URL using Logseq's asset API
     * @param path - The asset path to convert
     * @returns The full asset URL or the original path if API unavailable
     */
    static async makeAssetUrl(path: string): Promise<string> {
        if (path.startsWith("memory")) {
            // In web db ver, all images are memory link, those does not work properly with makeUrl
            path = path.replace(/^memory:\/[^/]+\/?/, ".");
        }

        let result = null;
        try {
            result = await logseq.Assets.makeUrl(path);
        } catch {}
        return result || path;
    }

    /**
     * Get the fetch API from parent window
     */
    static getFetch(): typeof fetch {
        return WindowParentBridge.getParentWindow().fetch.bind(WindowParentBridge.parentWindow);
    }

    /**
     * Open a URL in a new window/tab
     * @param url - The URL to open
     * @param target - The target (defaults to '_blank')
     * @param features - Window features string
     */
    static openWindow(url: string, target: string = "_blank", features?: string): Window | null {
        return WindowParentBridge.getParentWindow().open(url, target, features);
    }

    /**
     * Add event listener to parent window
     * @param event - Event name
     * @param handler - Event handler function
     * @param options - Event listener options
     */
    static addEventListener(
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void {
        WindowParentBridge.getParentWindow().addEventListener(event, handler, options);
    }

    /**
     * Remove event listener from parent window
     * @param event - Event name
     * @param handler - Event handler function
     * @param options - Event listener options
     */
    static removeEventListener(
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions
    ): void {
        WindowParentBridge.getParentWindow().removeEventListener(event, handler, options);
    }

    /**
     * Query selector on parent document
     * @param selector - CSS selector
     */
    static querySelector<E extends Element = Element>(selector: string): E | null {
        return WindowParentBridge.getDocument().querySelector<E>(selector);
    }

    /**
     * Query selector all on parent document
     * @param selector - CSS selector
     */
    static querySelectorAll<E extends Element = Element>(selector: string): NodeListOf<E> {
        return WindowParentBridge.getDocument().querySelectorAll<E>(selector);
    }

    /**
     * Get element by ID from parent document
     * @param id - Element ID
     */
    static getElementById(id: string): HTMLElement | null {
        return WindowParentBridge.getDocument().getElementById(id);
    }

    /**
     * Create an element in parent document
     * @param tagName - Tag name for the element
     */
    static createElement<K extends keyof HTMLElementTagNameMap>(
        tagName: K
    ): HTMLElementTagNameMap[K] {
        return WindowParentBridge.getDocument().createElement(tagName);
    }

    /**
     * Get a custom object from parent window
     * @param key - The key of the object on parent window
     */
    static getGlobalObject<T = any>(key: string): T | undefined {
        if (!WindowParentBridge.isInitialized()) return undefined;
        return (WindowParentBridge.parentWindow as any)?.[key];
    }

    /**
     * Set a custom object on parent window
     * @param key - The key to set
     * @param value - The value to set
     */
    static setGlobalObject<T = any>(key: string, value: T): void {
        const parent = WindowParentBridge.getParentWindow();
        (parent as any)[key] = value;
    }

    /**
     * Get the parent window's body element
     */
    static getBody(): HTMLElement {
        return WindowParentBridge.getDocument().body;
    }

    /**
     * Get the parent window's head element
     */
    static getHead(): HTMLHeadElement {
        return WindowParentBridge.getDocument().head;
    }

    /**
     * Reload the Logseq plugin
     * @param pluginId - The plugin ID to reload
     */
    static reloadPlugin(pluginId: string): void {
        const core = WindowParentBridge.getLSPluginCore();
        core.reload([pluginId]);
    }
}

// Auto-initialize with window.parent if in browser environment
if (typeof window !== "undefined" && typeof window.parent !== "undefined") {
    const canAccessHostScope = LogseqAppInfoFetcher.checkHostAccess(window.parent);
    // When host scope is not available, we are forced to use the current window
    // This may cause bugs but thats ok - we will run in compatibility mode
    WindowParentBridge.init(canAccessHostScope ? window.parent : window);
}
