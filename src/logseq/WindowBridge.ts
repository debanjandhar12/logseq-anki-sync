/**
 * WindowBridge - Abstraction layer for plugin sandbox window and document access
 *
 * This class provides a centralized, type-safe wrapper around the global window
 * and document objects within the Logseq plugin sandbox environment. It follows
 * the same pattern as WindowParentBridge but for the plugin's own execution context.
 *
 * Benefits:
 * - Testability: Can be mocked for unit tests
 * - Consistency: Single point of access for DOM operations
 * - Type Safety: Full TypeScript support with proper return types
 * - Future-proofing: Easier to adapt to environment changes
 */
export class WindowBridge {
    /**
     * Get the global window object
     * @returns The window object
     */
    static getWindow(): Window & typeof globalThis {
        return window;
    }

    /**
     * Get element by ID from the plugin document
     * @param id - Element ID
     * @returns The element or null
     */
    static getElementById(id: string): HTMLElement | null {
        return document.getElementById(id);
    }

    /**
     * Create an element in the plugin document
     * @param tagName - Tag name for the element
     * @returns The created element
     */
    static createElement<K extends keyof HTMLElementTagNameMap>(
        tagName: K
    ): HTMLElementTagNameMap[K] {
        return document.createElement(tagName);
    }

    /**
     * Get the plugin document's body element
     * @returns The body element
     */
    static getBody(): HTMLElement {
        return document.body;
    }

    /**
     * Query selector all on the plugin document
     * @param selector - CSS selector
     * @returns NodeList of all matching elements
     */
    static querySelectorAll<E extends Element = Element>(selector: string): NodeListOf<E> {
        return document.querySelectorAll<E>(selector);
    }

    /**
     * Add event listener to the plugin document
     * @param event - Event name
     * @param handler - Event handler function
     * @param options - Event listener options
     */
    static addDocumentEventListener(
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void {
        document.addEventListener(event, handler, options);
    }

    /**
     * Remove event listener from the plugin document
     * @param event - Event name
     * @param handler - Event handler function
     * @param options - Event listener options
     */
    static removeDocumentEventListener(
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions
    ): void {
        document.removeEventListener(event, handler, options);
    }
}

export default WindowBridge;
