import * as PortalPrimitive from "@radix-ui/react-portal-original";
import { type ComponentPropsWithoutRef, type ComponentRef, forwardRef } from "react";
import { getShadowDomCompatibility } from "../../src/ui/ShadowWrapper/installReactPopperShadowDomCompatibilityPatch";

type PortalElement = ComponentRef<typeof PortalPrimitive.Root>;
type PortalProps = ComponentPropsWithoutRef<typeof PortalPrimitive.Root>;

export const Root = forwardRef<PortalElement, PortalProps>(
    ({ container, ...props }, forwardedRef) => {
        const compatibility = getShadowDomCompatibility();

        return (
            <PortalPrimitive.Root
                {...props}
                ref={forwardedRef}
                container={container ?? (compatibility?.portalContainer as HTMLElement)}
            />
        );
    }
);

Root.displayName = PortalPrimitive.Root.displayName;
export const Portal = Root;
