import type {LucideIcon} from "lucide-react";
import {type ReactNode, useMemo} from "react";
import {
    computeDiff,
    DiffViewerLine,
    type DiffViewerProps,
    DiffViewerSplitLine,
    DiffViewerStats,
    diffViewerVariants,
    pairLinesForSplit,
    parsePatch
} from "src/shadcn/assistant-ui/diff-viewer";
import {cn} from "src/shadcn/lib/utils";
import {DiffViewerFrame} from "./DiffViewerFrame";

/**
 * Changes:
 * (a) Replaced DiffViewerHeader with an animated collapsible file header.
 * (b) Added support for a custom file icon in place of the extension badge.
 * (c) Shared the collapsible frame with AssetDiffViewer and added header metadata.
 */
export function LogseqPageDiffViewer({
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
    contentClassName,
    fileIcon,
    headerMetadata
}: DiffViewerProps & {
    contentClassName?: string;
    fileIcon?: LucideIcon | null;
    headerMetadata?: ReactNode;
}) {
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
                    fileIcon={fileIcon}
                    headerMetadata={headerMetadata}
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
    contentClassName,
    fileIcon,
    headerMetadata
}: {
    file: ReturnType<typeof parsePatch>[number];
    showIcon: boolean;
    showStats: boolean;
    showLineNumbers: boolean;
    viewMode: "split" | "unified";
    contentClassName?: string;
    fileIcon?: LucideIcon | null;
    headerMetadata?: ReactNode;
}) {
    return (
        <DiffViewerFrame
            oldName={file.oldName}
            newName={file.newName}
            showIcon={showIcon}
            fileIcon={fileIcon}
            contentClassName={contentClassName}
            metadata={
                <>
                    {headerMetadata}
                    {showStats && (file.additions > 0 || file.deletions > 0) && (
                        <DiffViewerStats additions={file.additions} deletions={file.deletions} />
                    )}
                </>
            }>
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
        </DiffViewerFrame>
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
