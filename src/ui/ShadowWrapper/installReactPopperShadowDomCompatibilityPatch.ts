import {offsetParent} from "composed-offset-position";

/**
 * Bridges positioning libraries that expect light-DOM ancestry into the chat
 * sidebar's shadow root. Radix Popper and Floating UI read global portal,
 * collision-boundary, and offset-parent state while ShadowWrapper is mounted.
 */
const portalContainersKey = "__LOGSEQ_AI_CHAT_PORTAL_CONTAINERS__";
const compatibilityStateKey = "__LOGSEQ_AI_CHAT_SHADOW_DOM_COMPATIBILITY__";

interface ShadowDomCompatibilityOptions {
    container: HTMLElement;
    portalContainer: Element | DocumentFragment;
}

interface ShadowDomCompatibilityState {
    collisionBoundary: Element;
    portalContainer: Element | DocumentFragment;
}

interface OffsetParentPatch {
    count: number;
    restore: () => void;
}

const offsetParentPatches = new WeakMap<Window, OffsetParentPatch>();

const getPortalContainers = (): Array<Element | DocumentFragment> => {
    const globalState = globalThis as typeof globalThis &
        Record<typeof portalContainersKey, Array<Element | DocumentFragment> | undefined>;

    globalState[portalContainersKey] ??= [];
    return globalState[portalContainersKey];
};

const getCompatibilityStates = (): ShadowDomCompatibilityState[] => {
    const globalState = globalThis as typeof globalThis &
        Record<typeof compatibilityStateKey, ShadowDomCompatibilityState[] | undefined>;

    globalState[compatibilityStateKey] ??= [];
    return globalState[compatibilityStateKey];
};

export const getShadowDomCompatibility = (): ShadowDomCompatibilityState | null => {
    return getCompatibilityStates().at(-1) ?? null;
};

const getElementWindow = (element: Element): DOMWindow => {
    return element.ownerDocument.defaultView ?? window;
};

type DOMWindow = Window & typeof globalThis;

const isRealmElement = (win: DOMWindow, value: unknown): value is Element => {
    return value instanceof win.Element;
};

const isRealmShadowRoot = (win: DOMWindow, value: unknown): value is ShadowRoot => {
    return typeof win.ShadowRoot !== "undefined" && value instanceof win.ShadowRoot;
};

const getStyleValue = (style: CSSStyleDeclaration, property: string): string => {
    return style.getPropertyValue(property) || String(style[property as any] ?? "");
};

const isWebKit = (win: DOMWindow): boolean => {
    return !!win.CSS?.supports?.("-webkit-backdrop-filter", "none");
};

const isContainingBlockStyle = (style: CSSStyleDeclaration, win: DOMWindow): boolean => {
    const transformProperties = ["transform", "translate", "scale", "rotate", "perspective"];
    const willChangeValues = ["transform", "translate", "scale", "rotate", "perspective", "filter"];
    const containValues = ["paint", "layout", "strict", "content"];
    const webKit = isWebKit(win);
    const containerType = getStyleValue(style, "container-type");
    const backdropFilter = getStyleValue(style, "backdrop-filter");
    const filter = getStyleValue(style, "filter");

    return (
        transformProperties.some((property) => {
            const value = getStyleValue(style, property);
            return value !== "" && value !== "none";
        }) ||
        (containerType !== "" && containerType !== "normal") ||
        (!webKit && backdropFilter !== "" && backdropFilter !== "none") ||
        (!webKit && filter !== "" && filter !== "none") ||
        willChangeValues.some((value) => getStyleValue(style, "will-change").includes(value)) ||
        containValues.some((value) => getStyleValue(style, "contain").includes(value))
    );
};

const getNodeWindow = (node: Node): DOMWindow => {
    return node.ownerDocument?.defaultView ?? window;
};

const getFlatTreeParent = (node: Node): Node | null => {
    const win = getNodeWindow(node);

    if (isRealmElement(win, node) && node.assignedSlot) {
        return node.assignedSlot;
    }

    if (isRealmShadowRoot(win, node.parentNode)) {
        return node.parentNode.host;
    }

    return node.parentNode;
};

export const getComposedOffsetParent = (element: HTMLElement): HTMLElement | null => {
    const win = getElementWindow(element);

    if (typeof Element !== "undefined" && element instanceof Element) {
        return offsetParent(element);
    }

    for (let ancestor: Node | null = element; ancestor; ancestor = getFlatTreeParent(ancestor)) {
        if (!isRealmElement(win, ancestor)) {
            continue;
        }

        if (win.getComputedStyle(ancestor).display === "none") {
            return null;
        }
    }

    for (
        let ancestor = getFlatTreeParent(element);
        ancestor;
        ancestor = getFlatTreeParent(ancestor)
    ) {
        if (!isRealmElement(win, ancestor)) {
            continue;
        }

        const style = win.getComputedStyle(ancestor);
        if (style.display === "contents") {
            continue;
        }

        if (style.position !== "static" || isContainingBlockStyle(style, win)) {
            return ancestor as HTMLElement;
        }

        if (ancestor.tagName === "BODY") {
            return ancestor as HTMLElement;
        }
    }

    return null;
};

const installComposedOffsetParent = (ownerWindow: DOMWindow) => {
    if (!ownerWindow.HTMLElement) {
        return () => {};
    }

    const existingPatch = offsetParentPatches.get(ownerWindow);
    if (existingPatch) {
        existingPatch.count += 1;
        return () => {
            existingPatch.count -= 1;

            if (existingPatch.count === 0) {
                existingPatch.restore();
                offsetParentPatches.delete(ownerWindow);
            }
        };
    }

    const originalDescriptor = Object.getOwnPropertyDescriptor(
        ownerWindow.HTMLElement.prototype,
        "offsetParent"
    );

    Object.defineProperty(ownerWindow.HTMLElement.prototype, "offsetParent", {
        configurable: true,
        get() {
            return getComposedOffsetParent(this);
        }
    });

    const patch: OffsetParentPatch = {
        count: 1,
        restore: () => {
            if (originalDescriptor) {
                Object.defineProperty(
                    ownerWindow.HTMLElement.prototype,
                    "offsetParent",
                    originalDescriptor
                );
            } else {
                Reflect.deleteProperty(ownerWindow.HTMLElement.prototype, "offsetParent");
            }
        }
    };
    offsetParentPatches.set(ownerWindow, patch);

    return () => {
        patch.count -= 1;

        if (patch.count === 0) {
            patch.restore();
            offsetParentPatches.delete(ownerWindow);
        }
    };
};

const installDefaultPortalContainer = (portalContainer: Element | DocumentFragment) => {
    const portalContainers = getPortalContainers();
    portalContainers.push(portalContainer);

    return () => {
        const containerIndex = portalContainers.lastIndexOf(portalContainer);
        if (containerIndex !== -1) {
            portalContainers.splice(containerIndex, 1);
        }
    };
};

const installCompatibilityState = (state: ShadowDomCompatibilityState) => {
    const compatibilityStates = getCompatibilityStates();
    compatibilityStates.push(state);

    return () => {
        const stateIndex = compatibilityStates.lastIndexOf(state);
        if (stateIndex !== -1) {
            compatibilityStates.splice(stateIndex, 1);
        }
    };
};

export const installReactPopperShadowDomCompatibilityPatch = ({
    container,
    portalContainer
}: ShadowDomCompatibilityOptions) => {
    const cleanupCompatibilityState = installCompatibilityState({
        collisionBoundary: container,
        portalContainer
    });
    const cleanupOffsetParent = installComposedOffsetParent(getElementWindow(container));
    const cleanupPortalContainer = installDefaultPortalContainer(portalContainer);

    return () => {
        cleanupPortalContainer();
        cleanupOffsetParent();
        cleanupCompatibilityState();
    };
};
