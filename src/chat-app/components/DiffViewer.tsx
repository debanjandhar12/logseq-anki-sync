import {useMemo, useState} from "react";
import {
    computeDiff,
    DiffViewerFileBadge,
    DiffViewerLine,
    type DiffViewerProps,
    DiffViewerSplitLine,
    DiffViewerStats,
    diffViewerVariants,
    pairLinesForSplit,
    parsePatch
} from "src/shadcn/assistant-ui/diff-viewer";
import {cn} from "src/shadcn/lib/utils";

/**
 * Changes:
 * (a) Replaced DiffViewerHeader with an animated collapsible file header.
 */
export function DiffViewer({
    code,
    patch,
    oldFile,
    newFile,
    viewMode = "unified",
    showLineNumbers = true,
    showIcon = true,
    showStats = true,
    variant,
    size,
    className,
    contentClassName
}: DiffViewerProps & {contentClassName?: string}) {
    const diffPatch = patch ?? code;

    const parsedFiles = useMemo(() => {
        if (diffPatch) {
            return parsePatch(diffPatch);
        }
        if (oldFile && newFile) {
            const {lines, additions, deletions} = computeDiff(oldFile.content, newFile.content);
            return [
                {
                    oldName: oldFile.name,
                    newName: newFile.name,
                    lines,
                    additions,
                    deletions
                }
            ];
        }
        return [];
    }, [diffPatch, oldFile, newFile]);

    if (parsedFiles.length === 0) {
        return (
            <pre data-slot="diff-viewer" className={cn("bg-muted rounded-lg p-4", className)}>
                No diff content provided
            </pre>
        );
    }

    return (
        <div
            data-slot="diff-viewer"
            data-view-mode={viewMode}
            data-variant={variant ?? "default"}
            data-size={size ?? "default"}
            className={cn(diffViewerVariants({variant, size}), className)}>
            {parsedFiles.map((file) => (
                <DiffViewerFile
                    key={`${file.oldName ?? ""}-${file.newName ?? ""}`}
                    file={file}
                    showIcon={showIcon}
                    showStats={showStats}
                    showLineNumbers={showLineNumbers}
                    viewMode={viewMode}
                    contentClassName={contentClassName}
                />
            ))}
        </div>
    );
}

function DiffViewerFile({
    file,
    showIcon,
    showStats,
    showLineNumbers,
    viewMode,
    contentClassName
}: {
    file: ReturnType<typeof parsePatch>[number];
    showIcon: boolean;
    showStats: boolean;
    showLineNumbers: boolean;
    viewMode: "split" | "unified";
    contentClassName?: string;
}) {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div data-slot="diff-viewer-file">
            <DiffViewerCollapsibleHeader
                oldName={file.oldName}
                newName={file.newName}
                additions={file.additions}
                deletions={file.deletions}
                isOpen={isOpen}
                showIcon={showIcon}
                showStats={showStats}
                onToggle={() => setIsOpen((current) => !current)}
            />
            <div
                data-state={isOpen ? "open" : "closed"}
                className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}>
                <div className="min-h-0 overflow-hidden">
                    <div
                        data-slot="diff-viewer-content"
                        className={cn("overflow-x-auto", contentClassName)}>
                        {viewMode === "split"
                            ? pairLinesForSplit(file.lines).map((pair) => (
                                  <DiffViewerSplitLine
                                      key={getSplitLineKey(pair)}
                                      pair={pair}
                                      showLineNumbers={showLineNumbers}
                                  />
                              ))
                            : file.lines.map((line) => (
                                  <DiffViewerLine
                                      key={getDiffLineKey(line)}
                                      line={line}
                                      showLineNumbers={showLineNumbers}
                                  />
                              ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function getSplitLineKey(pair: ReturnType<typeof pairLinesForSplit>[number]) {
    return `${pair.left ? getDiffLineKey(pair.left) : "empty"}|${
        pair.right ? getDiffLineKey(pair.right) : "empty"
    }`;
}

function getDiffLineKey(fileLine: ReturnType<typeof parsePatch>[number]["lines"][number]) {
    return `${fileLine.type}:${fileLine.oldLineNumber ?? ""}:${fileLine.newLineNumber ?? ""}:${
        fileLine.content
    }`;
}

function DiffViewerCollapsibleHeader({
    oldName,
    newName,
    additions,
    deletions,
    isOpen,
    showIcon,
    showStats,
    onToggle
}: {
    oldName?: string;
    newName?: string;
    additions: number;
    deletions: number;
    isOpen: boolean;
    showIcon: boolean;
    showStats: boolean;
    onToggle: () => void;
}) {
    if (!oldName && !newName) return null;

    const displayName = newName || oldName;

    return (
        <button
            type="button"
            data-slot="diff-viewer-header"
            aria-expanded={isOpen}
            className={cn(
                "flex w-full items-center gap-2 border-b bg-muted px-4 py-2 text-left text-muted-foreground",
                "transition-colors hover:bg-muted/80"
            )}
            onClick={onToggle}>
            <span
                aria-hidden="true"
                className={cn(
                    "w-3 shrink-0 text-center transition-transform duration-200 ease-out",
                    isOpen ? "rotate-90" : "rotate-0"
                )}>
                &gt;
            </span>
            {showIcon && <DiffViewerFileBadge filename={displayName} />}
            <span className="min-w-0 flex-1 truncate">
                {oldName && newName && oldName !== newName ? (
                    <>
                        <span className="text-red-600 dark:text-red-400">{oldName}</span>
                        {" -> "}
                        <span className="text-green-600 dark:text-green-400">{newName}</span>
                    </>
                ) : (
                    displayName
                )}
            </span>
            {showStats && (additions > 0 || deletions > 0) && (
                <DiffViewerStats additions={additions} deletions={deletions} />
            )}
        </button>
    );
}
