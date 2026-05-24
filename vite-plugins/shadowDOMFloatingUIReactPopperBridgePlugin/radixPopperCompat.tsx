import * as PopperPrimitive from "@radix-ui/react-popper-original";
import {type ComponentPropsWithoutRef, type ComponentRef, forwardRef} from "react";
import {getShadowDomCompatibility} from "../../src/ui/ShadowWrapper/installReactPopperShadowDomCompatibilityPatch";

type ContentElement = ComponentRef<typeof PopperPrimitive.Content>;
type ContentProps = ComponentPropsWithoutRef<typeof PopperPrimitive.Content>;

export const Content = forwardRef<ContentElement, ContentProps>(
    ({collisionBoundary, ...props}, forwardedRef) => {
        const compatibility = getShadowDomCompatibility();

        return (
            <PopperPrimitive.Content
                {...props}
                ref={forwardedRef}
                collisionBoundary={collisionBoundary ?? compatibility?.collisionBoundary}
            />
        );
    }
);

Content.displayName = PopperPrimitive.Content.displayName;

export const Root = PopperPrimitive.Root;
export const Anchor = PopperPrimitive.Anchor;
export const Arrow = PopperPrimitive.Arrow;
export const Popper = PopperPrimitive.Popper;
export const PopperAnchor = PopperPrimitive.PopperAnchor;
export const PopperArrow = PopperPrimitive.PopperArrow;
export const PopperContent = Content;
export const SIDE_OPTIONS = PopperPrimitive.SIDE_OPTIONS;
export const ALIGN_OPTIONS = PopperPrimitive.ALIGN_OPTIONS;
export const createPopperScope = PopperPrimitive.createPopperScope;
