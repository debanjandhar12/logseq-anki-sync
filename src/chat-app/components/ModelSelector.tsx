"use client";

import {useAui} from "@assistant-ui/react";
import {Radio} from "@base-ui/react/radio";
import {RadioGroup} from "@base-ui/react/radio-group";
import {cva, type VariantProps} from "class-variance-authority";
import {CheckIcon, ChevronDownIcon} from "lucide-react";
import {
    type ComponentPropsWithoutRef,
    createContext,
    memo,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {cn} from "src/shadcn/lib/utils";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator
} from "src/shadcn/radix-ui/command";
import {Popover, PopoverContent, PopoverTrigger} from "src/shadcn/radix-ui/popover";

/**
 * Adapted from @assistant-ui model-selector.
 * Changes:
 * (a) Import paths changed to project conventions (src/shadcn/...)
 * (b) Removed icon support (ModelIcon component and icon prop rendering) to keep it slim
 * (c) Removed logo / icon rendering — text-only items
 * (d) Added max-h-[200px] and a custom overlay scrollbar in ModelSelectorList
 *     (native scrollbar hidden since Chromium 114 aliases overflow:overlay to auto,
 *     which would reserve gutter space and squeeze the list).
 * (e) Controlled state uses prop presence so an empty model list can explicitly select nothing.
 * (f) Model context only registers IDs present in the current model list.
 */

export type ModelSelectorEffortOption = {
    id: string;
    name: string;
};

export const DEFAULT_EFFORT_OPTIONS: readonly ModelSelectorEffortOption[] = [
    {id: "low", name: "Low"},
    {id: "medium", name: "Med"},
    {id: "high", name: "High"}
];

export type ModelOption = {
    id: string;
    name: string;
    description?: string;
    disabled?: boolean;
    keywords?: readonly string[];
    efforts?: boolean | readonly ModelSelectorEffortOption[];
};

function getModelEfforts(
    model: ModelOption | undefined
): readonly ModelSelectorEffortOption[] | undefined {
    if (!model?.efforts) return undefined;
    return model.efforts === true ? DEFAULT_EFFORT_OPTIONS : model.efforts;
}

function resolveEffort(
    efforts: readonly ModelSelectorEffortOption[] | undefined,
    effort: string | undefined
): string | undefined {
    if (effort === undefined) return undefined;
    return efforts?.some((e) => e.id === effort) ? effort : undefined;
}

export function resolveModelEffort(
    models: readonly ModelOption[],
    modelId: string | undefined,
    effort: string | undefined
): string | undefined {
    return resolveEffort(getModelEfforts(models.find((m) => m.id === modelId)), effort);
}

function useControllableState<T>({
    prop,
    defaultProp,
    onChange,
    controlled
}: {
    prop: T | undefined;
    defaultProp: T | undefined;
    onChange: ((next: T) => void) | undefined;
    controlled: boolean;
}) {
    const [internal, setInternal] = useState(defaultProp);
    const value = controlled ? prop : internal;
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    });
    const setValue = useCallback(
        (next: T) => {
            if (!controlled) setInternal(next);
            onChangeRef.current?.(next);
        },
        [controlled]
    );
    return [value, setValue] as const;
}

type ModelSelectorContextValue = {
    models: readonly ModelOption[];
    value: string | undefined;
    setValue: (value: string) => void;
    selectedModel: ModelOption | undefined;
    efforts: readonly ModelSelectorEffortOption[] | undefined;
    effort: string | undefined;
    setEffort: (effort: string) => void;
    setOpen: (open: boolean) => void;
};

const ModelSelectorContext = createContext<ModelSelectorContextValue | null>(null);

function useModelSelectorContext() {
    const ctx = useContext(ModelSelectorContext);
    if (!ctx) {
        throw new Error("ModelSelector sub-components must be used within ModelSelector.Root");
    }
    return ctx;
}

export function useModelSelectorEfforts(): {
    efforts: readonly ModelSelectorEffortOption[] | undefined;
    effort: string | undefined;
    setEffort: (effort: string) => void;
} {
    const {efforts, effort, setEffort} = useModelSelectorContext();
    return {efforts, effort, setEffort};
}

export type ModelSelectorRootProps = {
    models: readonly ModelOption[];
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    effort?: string;
    defaultEffort?: string;
    onEffortChange?: (effort: string) => void;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
};

function ModelSelectorRoot(props: ModelSelectorRootProps) {
    const {
        models,
        value: valueProp,
        defaultValue,
        onValueChange,
        effort: effortProp,
        defaultEffort,
        onEffortChange,
        open: openProp,
        defaultOpen,
        onOpenChange,
        children
    } = props;
    const [value, setValue] = useControllableState({
        prop: valueProp,
        defaultProp: defaultValue ?? models[0]?.id,
        onChange: onValueChange,
        controlled: Object.hasOwn(props, "value")
    });
    const [effort, setEffort] = useControllableState({
        prop: effortProp,
        defaultProp: defaultEffort,
        onChange: onEffortChange,
        controlled: Object.hasOwn(props, "effort")
    });
    const [open, setOpen] = useControllableState({
        prop: openProp,
        defaultProp: defaultOpen ?? false,
        onChange: onOpenChange,
        controlled: Object.hasOwn(props, "open")
    });

    const selectedModel = models.find((m) => m.id === value);
    const efforts = getModelEfforts(selectedModel);
    const activeEffort = resolveEffort(efforts, effort);
    const contextValue = useMemo(
        () => ({
            models,
            value,
            setValue,
            selectedModel,
            efforts,
            effort: activeEffort,
            setEffort,
            setOpen
        }),
        [models, value, setValue, selectedModel, efforts, activeEffort, setEffort, setOpen]
    );

    return (
        <ModelSelectorContext.Provider value={contextValue}>
            <Popover open={open ?? false} onOpenChange={setOpen}>
                {children}
            </Popover>
        </ModelSelectorContext.Provider>
    );
}

export const modelSelectorTriggerVariants = cva(
    "focus-visible:ring-ring/50 flex w-fit items-center justify-between gap-2 overflow-hidden rounded-md text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
    {
        variants: {
            variant: {
                outline:
                    "border-input hover:bg-accent hover:text-accent-foreground border bg-transparent",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                muted: "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            },
            size: {
                default: "h-9 px-3 py-2",
                sm: "h-8 px-2.5 py-1.5 text-xs",
                lg: "h-10 px-4 py-2.5"
            }
        },
        defaultVariants: {
            variant: "outline",
            size: "default"
        }
    }
);

export type ModelSelectorTriggerProps = ComponentPropsWithoutRef<typeof PopoverTrigger> &
    VariantProps<typeof modelSelectorTriggerVariants>;

function ModelSelectorTrigger({
    className,
    variant,
    size,
    children,
    onKeyDown,
    ...props
}: ModelSelectorTriggerProps) {
    const {setOpen} = useModelSelectorContext();

    return (
        <PopoverTrigger
            data-slot="model-selector-trigger"
            data-variant={variant ?? "outline"}
            data-size={size ?? "default"}
            role="combobox"
            aria-haspopup="listbox"
            className={cn(modelSelectorTriggerVariants({variant, size}), className)}
            onKeyDown={(e) => {
                onKeyDown?.(e);
                if (e.defaultPrevented) return;
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setOpen(true);
                }
            }}
            {...props}>
            {children ?? <ModelSelectorValue />}
            <ChevronDownIcon className="size-4 opacity-50" />
        </PopoverTrigger>
    );
}

export type ModelSelectorValueProps = {
    placeholder?: ReactNode;
    showEffort?: boolean;
    className?: string;
};

function ModelSelectorValue({
    placeholder = "Select model",
    showEffort = true,
    className
}: ModelSelectorValueProps) {
    const {selectedModel, efforts, effort} = useModelSelectorContext();

    if (!selectedModel) {
        return (
            <span
                data-slot="model-selector-value"
                className={cn("text-muted-foreground", className)}>
                {placeholder}
            </span>
        );
    }

    const effortName =
        showEffort && effort !== undefined
            ? efforts?.find((e) => e.id === effort)?.name
            : undefined;

    return (
        <span
            data-slot="model-selector-value"
            className={cn("flex min-w-0 items-center gap-2", className)}>
            <span className="truncate font-medium">{selectedModel.name}</span>
            {effortName && (
                <span className="text-muted-foreground min-w-7.5 truncate text-center">
                    {effortName}
                </span>
            )}
        </span>
    );
}

export type ModelSelectorContentProps = Omit<
    ComponentPropsWithoutRef<typeof PopoverContent>,
    "side"
> & {
    side?: ComponentPropsWithoutRef<typeof PopoverContent>["side"];
    searchable?: boolean;
};

function useLazyFlipSide(): {
    side: ModelSelectorContentProps["side"];
    popupRef: (node: HTMLDivElement | null) => void;
} {
    const [side, setSide] = useState<ModelSelectorContentProps["side"]>();
    const observerRef = useRef<MutationObserver | null>(null);
    const popupRef = useCallback((node: HTMLDivElement | null) => {
        observerRef.current?.disconnect();
        observerRef.current = null;
        if (!node) {
            setSide(undefined);
            return;
        }
        const sync = () => {
            const rendered = node.getAttribute("data-side");
            if (rendered) setSide(rendered as ModelSelectorContentProps["side"]);
        };
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(node, {
            attributes: true,
            attributeFilter: ["data-side"]
        });
        observerRef.current = observer;
    }, []);
    return {side, popupRef};
}

function ModelSelectorFocusAnchor() {
    return (
        <div className="sr-only">
            <CommandInput readOnly aria-label="Model" />
        </div>
    );
}

function ModelSelectorContent({
    className,
    align = "start",
    side,
    sideOffset = 6,
    searchable,
    children,
    ...props
}: ModelSelectorContentProps) {
    const {value} = useModelSelectorContext();
    const {side: renderedSide, popupRef} = useLazyFlipSide();
    const unfiltered = searchable === false || (!searchable && children === undefined);

    return (
        <PopoverContent
            ref={popupRef}
            data-slot="model-selector-content"
            align={align}
            side={renderedSide ?? side ?? "bottom"}
            sideOffset={sideOffset}
            className={cn(
                "bg-popover/95 w-72 min-w-(--anchor-width) overflow-hidden rounded-xl p-0 shadow-lg backdrop-blur-sm",
                className
            )}
            {...props}>
            <Command
                className="bg-transparent"
                shouldFilter={!unfiltered}
                {...(value !== undefined ? {defaultValue: value} : {})}>
                {unfiltered && <ModelSelectorFocusAnchor />}
                {children ?? (
                    <>
                        {searchable && <ModelSelectorSearch />}
                        <ModelSelectorList />
                        <ModelSelectorEffort />
                    </>
                )}
            </Command>
        </PopoverContent>
    );
}

export type ModelSelectorSearchProps = ComponentPropsWithoutRef<typeof CommandInput>;

function ModelSelectorSearch({
    placeholder = "Search models...",
    ...props
}: ModelSelectorSearchProps) {
    return <CommandInput data-slot="model-selector-search" placeholder={placeholder} {...props} />;
}

export type ModelSelectorListProps = ComponentPropsWithoutRef<typeof CommandList>;

function ModelSelectorList({className, children, ...props}: ModelSelectorListProps) {
    const {models} = useModelSelectorContext();
    const listRef = useRef<HTMLDivElement>(null);
    const [scrollInfo, setScrollInfo] = useState({top: 0, height: 0, clientHeight: 0});

    const updateScroll = useCallback(() => {
        const el = listRef.current;
        if (!el) return;
        setScrollInfo({top: el.scrollTop, height: el.scrollHeight, clientHeight: el.clientHeight});
    }, []);

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        const observer = new ResizeObserver(updateScroll);
        observer.observe(el);
        el.addEventListener("scroll", updateScroll, {passive: true});
        updateScroll();
        return () => {
            observer.disconnect();
            el.removeEventListener("scroll", updateScroll);
        };
    }, [updateScroll]);

    const {top, height, clientHeight} = scrollInfo;
    const canScroll = height > clientHeight;
    const thumbHeight = canScroll ? Math.max(20, (clientHeight / height) * clientHeight) : 0;
    const thumbTop = canScroll ? (top / (height - clientHeight)) * (clientHeight - thumbHeight) : 0;

    return (
        <div className="relative">
            <CommandList
                ref={listRef}
                data-slot="model-selector-list"
                className={cn(
                    "max-h-[200px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    className
                )}
                {...props}>
                {children ?? (
                    <>
                        <ModelSelectorEmpty />
                        <CommandGroup>
                            {models.map((model) => (
                                <ModelSelectorItem key={model.id} model={model} />
                            ))}
                        </CommandGroup>
                    </>
                )}
            </CommandList>
            {canScroll && (
                <div className="pointer-events-none absolute inset-y-0 right-0 w-1.5">
                    <div
                        className="absolute right-0.5 w-1 rounded-full bg-foreground/25"
                        style={{top: thumbTop, height: thumbHeight}}
                    />
                </div>
            )}
        </div>
    );
}

export type ModelSelectorEmptyProps = ComponentPropsWithoutRef<typeof CommandEmpty>;

function ModelSelectorEmpty({children, ...props}: ModelSelectorEmptyProps) {
    return (
        <CommandEmpty data-slot="model-selector-empty" {...props}>
            {children ?? "No models found."}
        </CommandEmpty>
    );
}

export type ModelSelectorGroupProps = ComponentPropsWithoutRef<typeof CommandGroup>;

function ModelSelectorGroup(props: ModelSelectorGroupProps) {
    return <CommandGroup data-slot="model-selector-group" {...props} />;
}

export type ModelSelectorSeparatorProps = ComponentPropsWithoutRef<typeof CommandSeparator>;

function ModelSelectorSeparator(props: ModelSelectorSeparatorProps) {
    return <CommandSeparator data-slot="model-selector-separator" {...props} />;
}

export type ModelSelectorItemProps = Omit<ComponentPropsWithoutRef<typeof CommandItem>, "value"> & {
    model: ModelOption;
};

function ModelSelectorItem({
    model,
    className,
    children,
    onSelect,
    ...props
}: ModelSelectorItemProps) {
    const {value, setValue, setOpen} = useModelSelectorContext();
    const isSelected = value === model.id;

    return (
        <CommandItem
            data-slot="model-selector-item"
            value={model.id}
            keywords={[model.name, ...(model.keywords ?? [])]}
            {...(model.disabled ? {disabled: true} : undefined)}
            onSelect={(selectedValue) => {
                setValue(model.id);
                setOpen(false);
                onSelect?.(selectedValue);
            }}
            className={cn(
                "relative items-start gap-2 rounded-lg py-2 ps-3 pe-9 [&_svg:not([class*='size-'])]:size-3.5",
                className
            )}
            {...props}>
            {children ?? (
                <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{model.name}</span>
                    {model.description && (
                        <span className="text-muted-foreground truncate text-xs">
                            {model.description}
                        </span>
                    )}
                </span>
            )}
            {isSelected && (
                <span className="absolute end-3 top-2.5 flex size-4 items-center justify-center">
                    <CheckIcon className="size-4" />
                </span>
            )}
        </CommandItem>
    );
}

export type ModelSelectorEffortProps = ComponentPropsWithoutRef<"div"> & {
    label?: ReactNode;
};

function ModelSelectorEffort({
    label = "Thinking",
    className,
    onKeyDown,
    onKeyDownCapture,
    ...props
}: ModelSelectorEffortProps) {
    const {efforts, effort, setEffort} = useModelSelectorEfforts();

    if (!efforts?.length) return null;

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: adapted from assistant-ui model-selector upstream
        <div
            data-slot="model-selector-effort"
            className={cn(
                "flex cursor-default items-center justify-between gap-3 border-t px-3 py-2",
                className
            )}
            onKeyDownCapture={(e) => {
                onKeyDownCapture?.(e);
                if (e.defaultPrevented) return;
                if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                onKeyDown?.(e);
                if (e.defaultPrevented) return;
                const input = e.currentTarget
                    .closest("[cmdk-root]")
                    ?.querySelector<HTMLInputElement>("[cmdk-input]");
                if (!input) return;
                e.preventDefault();
                e.stopPropagation();
                input.focus();
                input.dispatchEvent(new KeyboardEvent("keydown", e.nativeEvent));
            }}
            onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowDown") return;
                onKeyDown?.(e);
                if (e.defaultPrevented) return;
                if (e.key === "Home" || e.key === "End") {
                    e.preventDefault();
                    e.stopPropagation();
                    const radios = Array.from(
                        e.currentTarget.querySelectorAll<HTMLElement>(
                            '[role="radio"]:not([data-disabled])'
                        )
                    );
                    (e.key === "Home" ? radios[0] : radios[radios.length - 1])?.focus();
                }
            }}
            {...props}>
            <span className="text-muted-foreground text-xs">{label}</span>
            <RadioGroup
                value={effort ?? ""}
                onValueChange={setEffort}
                aria-label={typeof label === "string" ? label : "Reasoning effort"}
                className="flex items-center gap-0.5">
                {efforts.map((option) => (
                    <Radio.Root
                        key={option.id}
                        value={option.id}
                        className={cn(
                            "focus-visible:ring-ring/50 text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-xs transition-colors outline-none focus-visible:ring-2",
                            "data-checked:bg-accent data-checked:text-accent-foreground data-checked:font-medium"
                        )}>
                        {option.name}
                    </Radio.Root>
                ))}
            </RadioGroup>
        </div>
    );
}

export type ModelSelectorProps = Omit<ModelSelectorRootProps, "children"> &
    VariantProps<typeof modelSelectorTriggerVariants> & {
        searchable?: boolean;
        align?: ModelSelectorContentProps["align"];
        className?: string;
        contentClassName?: string;
    };

function ModelSelectorModelContext() {
    const {selectedModel, effort} = useModelSelectorContext();
    const api = useAui();

    useEffect(() => {
        if (selectedModel === undefined) return;
        const config = {
            config: {
                modelName: selectedModel.id,
                ...(effort !== undefined ? {reasoningEffort: effort} : undefined)
            }
        };
        return api.modelContext().register({
            getModelContext: () => config
        });
    }, [api, selectedModel, effort]);

    return null;
}

const ModelSelectorImpl = ({
    searchable,
    variant,
    size,
    align,
    className,
    contentClassName,
    ...rootProps
}: ModelSelectorProps) => {
    return (
        <ModelSelectorRoot {...rootProps}>
            <ModelSelectorModelContext />
            <ModelSelectorTrigger variant={variant} size={size} className={className} />
            <ModelSelectorContent
                {...(align !== undefined ? {align} : {})}
                className={contentClassName}
                searchable={searchable ?? false}
            />
        </ModelSelectorRoot>
    );
};

type ModelSelectorComponent = typeof ModelSelectorImpl & {
    displayName?: string;
    Root: typeof ModelSelectorRoot;
    Trigger: typeof ModelSelectorTrigger;
    Value: typeof ModelSelectorValue;
    Content: typeof ModelSelectorContent;
    Search: typeof ModelSelectorSearch;
    FocusAnchor: typeof ModelSelectorFocusAnchor;
    List: typeof ModelSelectorList;
    Empty: typeof ModelSelectorEmpty;
    Group: typeof ModelSelectorGroup;
    Separator: typeof ModelSelectorSeparator;
    Item: typeof ModelSelectorItem;
    Effort: typeof ModelSelectorEffort;
};

const ModelSelector = memo(ModelSelectorImpl) as unknown as ModelSelectorComponent;

ModelSelector.displayName = "ModelSelector";
ModelSelector.Root = ModelSelectorRoot;
ModelSelector.Trigger = ModelSelectorTrigger;
ModelSelector.Value = ModelSelectorValue;
ModelSelector.Content = ModelSelectorContent;
ModelSelector.Search = ModelSelectorSearch;
ModelSelector.FocusAnchor = ModelSelectorFocusAnchor;
ModelSelector.List = ModelSelectorList;
ModelSelector.Empty = ModelSelectorEmpty;
ModelSelector.Group = ModelSelectorGroup;
ModelSelector.Separator = ModelSelectorSeparator;
ModelSelector.Item = ModelSelectorItem;
ModelSelector.Effort = ModelSelectorEffort;

export {
    ModelSelector,
    ModelSelectorContent,
    ModelSelectorEffort,
    ModelSelectorEmpty,
    ModelSelectorFocusAnchor,
    ModelSelectorGroup,
    ModelSelectorItem,
    ModelSelectorList,
    ModelSelectorRoot,
    ModelSelectorSearch,
    ModelSelectorSeparator,
    ModelSelectorTrigger,
    ModelSelectorValue
};
