import BOOK_ICON from "@tabler/icons/outline/book.svg?raw";
import HEART_ICON from "@tabler/icons/outline/heart.svg?raw";
import SIDE_BAR_ICON from "@tabler/icons/outline/layout-sidebar-right-expand.svg?raw";
import SETTINGS_ICON from "@tabler/icons/outline/settings.svg?raw";
import FocusTrap from "focus-trap-react";
import {showAIChat} from "../../chat";
import {WindowParentBridge} from "../../logseq/WindowParentBridge";
import type {FC} from "react";
// biome-ignore lint/style/useImportType: required for re-exported react
import React, {useEffect, useState} from "react";
import {UI} from "../UI";

const focusTrapOptions = {
    tabbableOptions: {
        displayCheck: "none" as const
    }
};

interface ToolbarMenuModalProps {
    triggerRect: DOMRect | null;
    parentWidth?: number;
    modalId: string;
}

const LogseqAIChatToolbarMenuComponent: FC<ToolbarMenuModalProps> = ({
    triggerRect,
    parentWidth,
    modalId
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const close = () => {
        setIsVisible(false);
        setTimeout(() => UI.hideModal(modalId), 150);
    };

    const rightPos = triggerRect ? (parentWidth || window.innerWidth) - triggerRect.right : 20;
    const topPos = triggerRect ? triggerRect.bottom + 8 : 40;

    const items = [
        {
            icon: SIDE_BAR_ICON,
            text: "Open Chat",
            disabled: false,
            onClick: showAIChat
        },
        {separator: true},
        {
            icon: SETTINGS_ICON,
            text: "Settings",
            disabled: false,
            onClick: () => logseq.showSettingsUI()
        },
        {separator: true},
        {
            icon: BOOK_ICON,
            text: "Documentation",
            disabled: true,
            onClick: () =>
                window.open("https://debanjandhar12.github.io/logseq-anki-sync/docs/intro")
        },
        {
            icon: HEART_ICON,
            text: "Donate",
            disabled: false,
            onClick: () => window.open("https://github.com/sponsors/debanjandhar12")
        }
    ];

    const selectableItems = items.filter((i) => !i.separator && !i.disabled);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev >= selectableItems.length - 1 ? 0 : prev + 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev <= 0 ? selectableItems.length - 1 : prev - 1));
            } else if (
                e.key === "Enter" &&
                selectedIndex >= 0 &&
                selectedIndex < selectableItems.length
            ) {
                e.preventDefault();
                close();
                selectableItems[selectedIndex].onClick?.();
            } else if (e.key === "Escape") {
                e.preventDefault();
                close();
            }
        };

        const doc = WindowParentBridge.getDocument();
        doc.addEventListener("keydown", handleKeyDown, true);
        window.addEventListener("keydown", handleKeyDown, true);
        return () => {
            doc.removeEventListener("keydown", handleKeyDown, true);
            window.removeEventListener("keydown", handleKeyDown, true);
        };
    }, [selectableItems, selectedIndex]);

    const MenuItem = ({item, isSelected}: any) => {
        if (item.separator) {
            return (
                <div
                    role="separator"
                    className="-mx-1 my-1 h-px bg-muted"
                    style={{backgroundColor: "var(--ls-border-color, #eee)"}}></div>
            );
        }
        return (
            <div
                role="menuitem"
                tabIndex={item.disabled ? -1 : 0}
                className={`ui__dropdown-menu-item relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors ${item.disabled ? "pointer-events-none opacity-50" : ""}`}
                style={{
                    backgroundColor: isSelected
                        ? "var(--ls-quaternary-background-color, #ddd)"
                        : "transparent"
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (item.disabled) return;
                    close();
                    item.onClick();
                }}
                onMouseEnter={() => {
                    if (!item.disabled) setSelectedIndex(selectableItems.indexOf(item));
                }}
                onMouseLeave={() => {
                    if (!item.disabled) setSelectedIndex(-1);
                }}>
                <span className="flex items-center w-full">
                    <span
                        className={`ui__icon ti flex items-center ${item.color || ""}`}
                        dangerouslySetInnerHTML={{__html: item.icon}}
                        style={{width: 18, height: 18}}
                    />
                    <span className="pl-2">{item.text}</span>
                </span>
            </div>
        );
    };

    return (
        <FocusTrap focusTrapOptions={focusTrapOptions}>
            <div style={{position: "fixed", inset: 0, zIndex: 9999}}>
                {/* Backdrop */}
                <div
                    style={{position: "absolute", inset: 0}}
                    onClick={(e) => {
                        e.stopPropagation();
                        close();
                    }}
                />

                {/* Menu */}
                <div
                    className={`ui__dropdown-menu-content z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md transition-all duration-150 ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
                    style={{
                        position: "absolute",
                        right: rightPos,
                        top: topPos,
                        backgroundColor: "var(--ls-primary-background-color, #fff)",
                        borderColor: "var(--ls-border-color, #eee)",
                        color: "var(--ls-primary-text-color, #000)",
                        transformOrigin: "top right"
                    }}>
                    {items.map((item, idx) => (
                        <MenuItem
                            key={idx}
                            item={item}
                            isSelected={
                                !item.separator &&
                                !item.disabled &&
                                selectableItems.indexOf(item) === selectedIndex
                            }
                        />
                    ))}
                </div>
            </div>
        </FocusTrap>
    );
};

export function showToolbarMenu(triggerRect: DOMRect | null, parentWidth?: number) {
    const modalId = `modal-toolbar-${Date.now()}`;
    UI.showModal(
        <LogseqAIChatToolbarMenuComponent
            modalId={modalId}
            triggerRect={triggerRect}
            parentWidth={parentWidth}
        />,
        modalId
    );
}
