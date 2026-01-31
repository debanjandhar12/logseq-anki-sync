import "@logseq/libs";

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
        this.parentWindow = parent;
        this.initialized = true;
    }

    /**
     * Check if WindowParentBridge has been initialized
     */
    static isInitialized(): boolean {
        return this.initialized && this.parentWindow !== null;
    }

    /**
     * Get the parent window instance
     * @throws Error if WindowParentBridge not initialized
     */
    private static getParentWindow(): Window {
        if (!this.isInitialized()) {
            throw new Error('WindowParentBridge not initialized. Call WindowParentBridge.init() first.');
        }
        return this.parentWindow!;
    }

    /**
     * Get the internal Logseq API object from parent window
     * @throws Error if WindowParentBridge not initialized
     */
    static getInternalLogseqAPI(): typeof logseq {
        const parent = this.getParentWindow();
        if (!(parent as any).logseq) {
            throw new Error('Logseq API not available on parent window');
        }
        return (parent as any).logseq;
    }

    /**
     * Get the parent document for DOM manipulation
     */
    static getDocument(): Document {
        return this.getParentWindow().document;
    }

    /**
     * Dispatch a custom event on the parent window
     * @param eventName - Name of the event to dispatch
     * @param detail - Optional event detail data
     */
    static dispatchEvent(eventName: string, detail?: any): void {
        if (!this.isInitialized()) return;
        
        const event = new CustomEvent(eventName, { detail });
        this.parentWindow!.dispatchEvent(event);
    }

    /**
     * Get the LogseqAnkiSync global object for event dispatching
     */
    static getLogseqAnkiSync(): { dispatchEvent: (event: string) => void } {
        const parent = this.getParentWindow();
        if (!(parent as any).LogseqAnkiSync) {
            throw new Error('LogseqAnkiSync not available on parent window');
        }
        return (parent as any).LogseqAnkiSync;
    }

    /**
     * Dispatch a LogseqAnkiSync event
     * @param eventName - Name of the event (e.g., 'syncLogseqToAnkiComplete')
     */
    static dispatchLogseqAnkiSyncEvent(eventName: string): void {
        const logseqAnkiSync = this.getLogseqAnkiSync();
        logseqAnkiSync.dispatchEvent(eventName);
    }

    /**
     * Get the AnkiConnect global object
     */
    static getAnkiConnect(): any {
        const parent = this.getParentWindow();
        if (!(parent as any).AnkiConnect) {
            throw new Error('AnkiConnect not available on parent window');
        }
        return (parent as any).AnkiConnect;
    }

    /**
     * Get the LSPluginCore for plugin management
     */
    static getLSPluginCore(): any {
        const parent = this.getParentWindow();
        if (!(parent as any).LSPluginCore) {
            throw new Error('LSPluginCore not available on parent window');
        }
        return (parent as any).LSPluginCore;
    }

    /**
     * Make an asset URL using Logseq's asset API
     * @param path - The asset path to convert
     * @returns The full asset URL or the original path if API unavailable
     */
    static async makeAssetUrl(path: string): Promise<string> {
        try {
            return await logseq.Assets.makeUrl(path) || path;
        } catch {
            return path;
        }
    }

    /**
     * Get the fetch API from parent window
     */
    static getFetch(): typeof fetch {
        return this.getParentWindow().fetch.bind(this.parentWindow);
    }

    /**
     * Open a URL in a new window/tab
     * @param url - The URL to open
     * @param target - The target (defaults to '_blank')
     * @param features - Window features string
     */
    static openWindow(url: string, target: string = '_blank', features?: string): Window | null {
        return this.getParentWindow().open(url, target, features);
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
        this.getParentWindow().addEventListener(event, handler, options);
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
        this.getParentWindow().removeEventListener(event, handler, options);
    }

    /**
     * Query selector on parent document
     * @param selector - CSS selector
     */
    static querySelector<E extends Element = Element>(selector: string): E | null {
        return this.getDocument().querySelector<E>(selector);
    }

    /**
     * Query selector all on parent document
     * @param selector - CSS selector
     */
    static querySelectorAll<E extends Element = Element>(selector: string): NodeListOf<E> {
        return this.getDocument().querySelectorAll<E>(selector);
    }

    /**
     * Get element by ID from parent document
     * @param id - Element ID
     */
    static getElementById(id: string): HTMLElement | null {
        return this.getDocument().getElementById(id);
    }

    /**
     * Create an element in parent document
     * @param tagName - Tag name for the element
     */
    static createElement<K extends keyof HTMLElementTagNameMap>(
        tagName: K
    ): HTMLElementTagNameMap[K] {
        return this.getDocument().createElement(tagName);
    }

    /**
     * Get a custom object from parent window
     * @param key - The key of the object on parent window
     */
    static getGlobalObject<T = any>(key: string): T | undefined {
        if (!this.isInitialized()) return undefined;
        return (this.parentWindow as any)?.[key];
    }

    /**
     * Set a custom object on parent window
     * @param key - The key to set
     * @param value - The value to set
     */
    static setGlobalObject<T = any>(key: string, value: T): void {
        const parent = this.getParentWindow();
        (parent as any)[key] = value;
    }

    /**
     * Get the parent window's body element
     */
    static getBody(): HTMLElement {
        return this.getDocument().body;
    }

    /**
     * Get the parent window's head element
     */
    static getHead(): HTMLHeadElement {
        return this.getDocument().head;
    }

    /**
     * Reload the Logseq plugin
     * @param pluginId - The plugin ID to reload
     */
    static reloadPlugin(pluginId: string): void {
        const core = this.getLSPluginCore();
        core.reload([pluginId]);
    }
}

// Auto-initialize with window.parent if in browser environment
if (typeof window !== 'undefined' && typeof window.parent !== 'undefined') {
    let canAccessHostScope = false;
    try {
        canAccessHostScope = window.parent.addEventListener !== null;
    } catch {}
    // When host scope is not available, we are forced to use the current window
    // This may cause bugs but thats ok - we will run in compatibility mode
    WindowParentBridge.init(canAccessHostScope ? window.parent : window);
}
