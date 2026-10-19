import type {LucideIcon} from "lucide-react";
import {type ReactNode, useState} from "react";
import {DiffViewerFileBadge} from "src/shadcn/assistant-ui/diff-viewer";
import {cn} from "src/shadcn/lib/utils";

/** Shared custom header/collapse pattern for the page and asset viewers. */
export function DiffViewerFrame({
    oldName,
    newName,
    fileIcon: FileIcon,
    showIcon = true,
    metadata,
    contentClassName,
    children
}: {
    oldName?: string;
    newName?: string;
    fileIcon?: LucideIcon | null;
    showIcon?: boolean;
    metadata?: ReactNode;
    contentClassName?: string;
    children: ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(true);
    const displayName = newName || oldName;
    return (
        <div data-slot="diff-viewer-file">
            {displayName && (
                <button
                    type="button"
                    data-slot="diff-viewer-header"
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-2 border-b bg-muted px-4 py-2 text-left text-muted-foreground transition-colors hover:bg-muted/80"
                    onClick={() => setIsOpen((current) => !current)}>
                    <span
                        aria-hidden="true"
                        className={cn(
                            "w-3 shrink-0 text-center transition-transform duration-200 ease-out",
                            isOpen ? "rotate-90" : "rotate-0"
                        )}>
                        &gt;
                    </span>
                    {showIcon &&
                        (FileIcon ? (
                            <FileIcon
                                data-slot="diff-viewer-file-icon"
                                className="size-4 shrink-0 text-muted-foreground"
                            />
                        ) : (
                            <DiffViewerFileBadge filename={displayName} />
                        ))}
                    <span className="min-w-0 flex-1 truncate" title={displayName}>
                        {oldName && newName && oldName !== newName ? (
                            <>
                                <span className="text-red-600 dark:text-red-400">{oldName}</span>
                                {" -> "}
                                <span className="text-green-600 dark:text-green-400">
                                    {newName}
                                </span>
                            </>
                        ) : (
                            displayName
                        )}
                    </span>
                    {metadata}
                </button>
            )}
            <div
                data-state={isOpen ? "open" : "closed"}
                inert={!isOpen}
                className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}>
                <div className="min-h-0 overflow-hidden">
                    <div
                        data-slot="diff-viewer-content"
                        className={cn("overflow-x-auto", contentClassName)}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
