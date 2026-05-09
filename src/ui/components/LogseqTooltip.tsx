import {autoUpdate, computePosition, flip, offset, type Placement, shift} from "@floating-ui/react";
import {WindowBridge} from "../../logseq/WindowBridge";
import React, {type FC, useCallback, useEffect, useRef, useState} from "../React";
import {createPortal} from "../ReactDOM";

interface LogseqTooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    placement?: Placement;
    delayDuration?: number;
}

export const LogseqTooltip: FC<LogseqTooltipProps> = ({
    content,
    children,
    placement = "top",
    delayDuration = 200
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({x: 0, y: 0});
    const [isPositioned, setIsPositioned] = useState(false);
    const triggerRef = useRef<HTMLElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updatePosition = useCallback(() => {
        if (triggerRef.current && tooltipRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                return;
            }
            computePosition(triggerRef.current, tooltipRef.current, {
                placement,
                middleware: [offset(8), flip(), shift({padding: 8})]
            }).then(({x, y}) => {
                setPosition({x, y});
                setIsPositioned(true);
            });
        }
    }, [placement]);

    useEffect(() => {
        if (!isOpen) {
            setIsPositioned(false);
            return;
        }

        let cleanup: (() => void) | undefined;
        if (triggerRef.current && tooltipRef.current) {
            cleanup = autoUpdate(triggerRef.current, tooltipRef.current, updatePosition);
        }
        return cleanup;
    }, [isOpen, updatePosition]);

    const handleMouseEnter = useCallback(() => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        if (!openTimeoutRef.current) {
            openTimeoutRef.current = setTimeout(() => {
                setIsOpen(true);
                openTimeoutRef.current = null;
            }, delayDuration);
        }
    }, [delayDuration]);

    const handleMouseLeave = useCallback(() => {
        if (openTimeoutRef.current) {
            clearTimeout(openTimeoutRef.current);
            openTimeoutRef.current = null;
        }
        closeTimeoutRef.current = setTimeout(() => {
            setIsOpen(false);
            closeTimeoutRef.current = null;
        }, 100);
    }, []);

    useEffect(() => {
        return () => {
            if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        };
    }, []);

    const tooltipElement =
        isOpen && content ? (
            <div
                ref={tooltipRef}
                role="tooltip"
                className="z-[9999] overflow-hidden rounded-md border shadow-md animate-in fade-in-0 zoom-in-95"
                style={{
                    position: "fixed",
                    left: position.x,
                    top: position.y,
                    visibility: isPositioned ? "visible" : "hidden",
                    backgroundColor:
                        "var(--ls-popover-background-color, var(--ls-primary-background-color))",
                    color: "var(--ls-popover-text-color, var(--ls-primary-text-color))",
                    borderColor: "var(--ls-border-color)",
                    padding: "0.375rem 0.75rem",
                    fontSize: "0.875rem",
                    lineHeight: "1.25rem",
                    maxWidth: "16rem",
                    whiteSpace: "pre-wrap"
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
                style={{display: "inline-block"}}>
                {children}
            </span>
            {tooltipElement && createPortal(tooltipElement, WindowBridge.getElementById("app")!)}
        </>
    );
};
