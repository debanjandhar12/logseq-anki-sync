import {autoUpdate, computePosition, flip, offset, type Placement, shift} from "@floating-ui/react";
import {WindowBridge} from "../../logseq/WindowBridge";
import React, {type FC, useCallback, useEffect, useRef, useState} from "../React";
import {createPortal} from "../ReactDOM";

interface LogseqPopoverProps {
    content: React.ReactNode;
    children: React.ReactNode;
    placement?: Placement;
    offsetY?: number;
    usePortal?: boolean;
}

export const LogseqPopover: FC<LogseqPopoverProps> = ({
    content,
    children,
    placement = "bottom-end",
    offsetY = -4,
    usePortal = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({x: 0, y: 0});
    const [isPositioned, setIsPositioned] = useState(false);
    const triggerRef = useRef<HTMLSpanElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updatePosition = useCallback(() => {
        if (triggerRef.current && popoverRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                return;
            }
            computePosition(triggerRef.current, popoverRef.current, {
                placement,
                middleware: [offset(offsetY), flip(), shift({padding: 8})]
            }).then(({x, y}) => {
                setPosition({x, y});
                setIsPositioned(true);
            });
        }
    }, [placement, offsetY]);

    useEffect(() => {
        if (!isOpen) {
            setIsPositioned(false);
            return;
        }

        let cleanup: (() => void) | undefined;
        if (triggerRef.current && popoverRef.current) {
            cleanup = autoUpdate(triggerRef.current, popoverRef.current, updatePosition);
        }
        return cleanup;
    }, [isOpen, updatePosition]);

    const handleMouseEnter = useCallback(() => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        setIsOpen(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
        }
        closeTimeoutRef.current = setTimeout(() => {
            setIsOpen(false);
            closeTimeoutRef.current = null;
        }, 200);
    }, []);

    useEffect(() => {
        return () => {
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        };
    }, []);

    const popoverElement =
        isOpen && content ? (
            <div
                ref={popoverRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="z-[9999]"
                style={{
                    position: "fixed",
                    left: position.x,
                    top: position.y,
                    visibility: isPositioned ? "visible" : "hidden"
                }}>
                {content}
            </div>
        ) : null;

    return (
        <>
            <span
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={{display: "inline-flex", cursor: "pointer", alignItems: "center"}}>
                {children}
            </span>
            {usePortal && popoverElement
                ? createPortal(popoverElement, WindowBridge.getElementById("app")!)
                : popoverElement}
        </>
    );
};
