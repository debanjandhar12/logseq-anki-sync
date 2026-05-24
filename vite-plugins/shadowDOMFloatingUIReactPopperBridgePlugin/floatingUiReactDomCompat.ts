import * as FloatingUIReactDom from "@floating-ui/react-dom-original";
import {
    getComposedOffsetParent,
    getShadowDomCompatibility
} from "../../src/ui/ShadowWrapper/installReactPopperShadowDomCompatibilityPatch";

type FloatingPlatform = typeof FloatingUIReactDom.platform;
type GetClippingRectOptions = Parameters<FloatingPlatform["getClippingRect"]>[0];
type Boundary = GetClippingRectOptions["boundary"];

const isEmptyBoundary = (boundary: Boundary): boolean => {
    return Array.isArray(boundary) && boundary.length === 0;
};

const resolveCollisionBoundary = (boundary: Boundary): Boundary => {
    const compatibility = getShadowDomCompatibility();

    if (!compatibility) {
        return boundary;
    }

    if (boundary === "clippingAncestors" || isEmptyBoundary(boundary)) {
        return compatibility.collisionBoundary;
    }

    return boundary;
};

export const platform: FloatingPlatform = {
    ...FloatingUIReactDom.platform,
    getClippingRect(args) {
        return FloatingUIReactDom.platform.getClippingRect({
            ...args,
            boundary: resolveCollisionBoundary(args.boundary)
        });
    },
    getOffsetParent(element, polyfill) {
        return FloatingUIReactDom.platform.getOffsetParent(
            element,
            polyfill ?? getComposedOffsetParent
        );
    }
};

export const useFloating: typeof FloatingUIReactDom.useFloating = (options) => {
    const compatibility = getShadowDomCompatibility();
    const resolvedPlatform = options?.platform ?? (compatibility ? platform : undefined);
    const resolvedOptions = resolvedPlatform ? {...options, platform: resolvedPlatform} : options;

    return FloatingUIReactDom.useFloating(resolvedOptions);
};

export * from "@floating-ui/react-dom-original";
