import {
    autoUpdate,
    flip,
    offset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useRole
} from "@floating-ui/react";
import {ChevronRight, ListTree} from "lucide-react";
import React from "react";
import {COMMAND_INVOKE_LOCATION_TREE, COMMAND_INVOKE_LOCATIONS} from "src/core/command-parser";
import type {CommandInvokeLocation} from "src/core/stores/command-file-store/types";
import {LogseqCheckbox} from "../../components/LogseqCheckbox";

export interface InvokeLocationTreePopoverProps {
    value: readonly CommandInvokeLocation[];
    readOnly?: boolean;
    onValueChange: (value: CommandInvokeLocation[]) => void;
}

export function getCategoryCheckState(
    selected: ReadonlySet<CommandInvokeLocation>,
    children: readonly CommandInvokeLocation[]
): {checked: boolean; indeterminate: boolean} {
    const selectedCount = children.filter((location) => selected.has(location)).length;
    return {
        checked: selectedCount === children.length,
        indeterminate: selectedCount > 0 && selectedCount < children.length
    };
}

export const InvokeLocationTreePopover: React.FC<InvokeLocationTreePopoverProps> = ({
    value,
    readOnly = false,
    onValueChange
}) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [expandedCategories, setExpandedCategories] = React.useState(
        () => new Set(["Block Context Menu", "Page Context Menu"])
    );
    const popoverId = React.useId();
    const wasOpen = React.useRef(false);
    const selected = React.useMemo(() => new Set(value), [value]);
    const {refs, floatingStyles, context} = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: "bottom-end",
        strategy: "fixed",
        whileElementsMounted: autoUpdate,
        middleware: [offset(6), flip(), shift({padding: 8})]
    });
    const {getReferenceProps, getFloatingProps} = useInteractions([
        useClick(context),
        useDismiss(context),
        useRole(context, {role: "dialog"})
    ]);

    React.useEffect(() => {
        if (isOpen) {
            wasOpen.current = true;
            requestAnimationFrame(() => {
                refs.floating.current?.querySelector<HTMLElement>("input, button")?.focus();
            });
        } else if (wasOpen.current) {
            (refs.domReference.current as HTMLElement | null)?.focus();
        }
    }, [isOpen, refs.domReference, refs.floating]);

    const emitSelection = (nextSelected: ReadonlySet<CommandInvokeLocation>) => {
        onValueChange(COMMAND_INVOKE_LOCATIONS.filter((location) => nextSelected.has(location)));
    };

    const toggleLeaf = (location: CommandInvokeLocation) => {
        if (readOnly) return;
        const nextSelected = new Set(selected);
        if (nextSelected.has(location)) nextSelected.delete(location);
        else nextSelected.add(location);
        emitSelection(nextSelected);
    };

    const toggleCategory = (children: readonly CommandInvokeLocation[]) => {
        if (readOnly) return;
        const nextSelected = new Set(selected);
        const allSelected = children.every((location) => nextSelected.has(location));
        for (const location of children) {
            if (allSelected) nextSelected.delete(location);
            else nextSelected.add(location);
        }
        emitSelection(nextSelected);
    };

    const toggleExpanded = (label: string) => {
        setExpandedCategories((current) => {
            const next = new Set(current);
            if (next.has(label)) next.delete(label);
            else next.add(label);
            return next;
        });
    };

    return (
        <div className="relative">
            <button
                ref={refs.setReference}
                type="button"
                aria-label="Choose command invocation locations"
                aria-controls={popoverId}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                title="Invocation locations"
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-transparent text-text transition-colors hover:bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                {...getReferenceProps()}>
                <ListTree aria-hidden="true" size={16} />
            </button>
            {isOpen && (
                <div
                    ref={refs.setFloating}
                    id={popoverId}
                    role="dialog"
                    aria-label="Command invocation locations"
                    className="z-[10000] max-h-[min(60vh,28rem)] w-80 overflow-y-auto rounded-md border border-border bg-secondary-background p-2 text-text shadow-lg"
                    style={floatingStyles}
                    {...getFloatingProps({
                        onKeyDown: (event) => {
                            if (event.key === "Escape") {
                                event.preventDefault();
                                event.stopPropagation();
                                setIsOpen(false);
                                return;
                            }
                            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

                            const items = Array.from(
                                event.currentTarget.querySelectorAll<HTMLElement>(
                                    "button:not([disabled]), input:not([disabled])"
                                )
                            );
                            const currentIndex = items.indexOf(
                                document.activeElement as HTMLElement
                            );
                            const direction = event.key === "ArrowDown" ? 1 : -1;
                            const nextIndex =
                                currentIndex < 0
                                    ? 0
                                    : (currentIndex + direction + items.length) % items.length;
                            event.preventDefault();
                            event.stopPropagation();
                            items[nextIndex]?.focus();
                        }
                    })}>
                    <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wide opacity-70">
                        Invocation locations
                    </div>
                    <fieldset className="border-0 p-0">
                        <legend className="sr-only">Command invocation locations</legend>
                        {COMMAND_INVOKE_LOCATION_TREE.map((node) => {
                            if ("children" in node) {
                                const isExpanded = expandedCategories.has(node.label);
                                const state = getCategoryCheckState(selected, node.children);
                                return (
                                    <fieldset
                                        key={node.label}
                                        className="rounded border-0 px-1 py-0.5">
                                        <legend className="sr-only">{node.label}</legend>
                                        <div className="flex items-center gap-1 rounded px-1 py-1 hover:bg-tertiary/50">
                                            <button
                                                type="button"
                                                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.label}`}
                                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                onClick={() => toggleExpanded(node.label)}>
                                                <ChevronRight
                                                    aria-hidden="true"
                                                    size={14}
                                                    className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                                />
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <LogseqCheckbox
                                                    checked={state.checked}
                                                    indeterminate={state.indeterminate}
                                                    disabled={readOnly}
                                                    onChange={() => toggleCategory(node.children)}>
                                                    {node.label}
                                                </LogseqCheckbox>
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <fieldset className="ml-7 border-0 border-border border-l pl-3">
                                                <legend className="sr-only">
                                                    {node.label} options
                                                </legend>
                                                {node.children.map((location) => (
                                                    <div
                                                        key={location}
                                                        className="rounded px-1 py-1 hover:bg-tertiary/50">
                                                        <LogseqCheckbox
                                                            checked={selected.has(location)}
                                                            disabled={readOnly}
                                                            onChange={() => toggleLeaf(location)}>
                                                            {getLocationLeafLabel(location)}
                                                        </LogseqCheckbox>
                                                    </div>
                                                ))}
                                            </fieldset>
                                        )}
                                    </fieldset>
                                );
                            }

                            return (
                                <div
                                    key={node.value}
                                    className="rounded px-2 py-1.5 hover:bg-tertiary/50">
                                    <LogseqCheckbox
                                        checked={selected.has(node.value)}
                                        disabled={readOnly}
                                        onChange={() => toggleLeaf(node.value)}>
                                        {node.label}
                                    </LogseqCheckbox>
                                </div>
                            );
                        })}
                    </fieldset>
                </div>
            )}
        </div>
    );
};

function getLocationLeafLabel(location: CommandInvokeLocation): string {
    return location.includes("/") ? location.slice(location.lastIndexOf("/") + 1) : location;
}
