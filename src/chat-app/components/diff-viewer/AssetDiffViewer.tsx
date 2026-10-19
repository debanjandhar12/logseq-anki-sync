import {FileIcon, FileTextIcon, ImageIcon} from "lucide-react";
import {type ReactNode, useState} from "react";
import type {
    AssetChangeSide,
    LogseqPrintedAssetChange
} from "src/core/logseq-reversible-transaction-tracker";
import {diffViewerVariants} from "src/shadcn/assistant-ui/diff-viewer";
import {cn} from "src/shadcn/lib/utils";
import {DiffViewerFrame} from "./DiffViewerFrame";
import {LogseqPageDiffViewer} from "./LogseqPageDiffViewer";

/** Asset-specific body and metadata using the same custom frame as the page viewer. */
export function AssetDiffViewer({change}: {change: LogseqPrintedAssetChange}) {
    const {before, after} = change;
    const textOnly = [before, after].every((side) => !side.exists || side.preview.kind === "text");
    const metadata = (
        <span className="flex shrink-0 flex-wrap gap-x-2 text-xs">
            <span className="capitalize">{change.status}</span>
            <span>
                {formatSideSize(before)} → {formatSideSize(after)}
            </span>
        </span>
    );
    const className = "rounded border border-border bg-secondary-background";
    if (textOnly)
        return (
            <LogseqPageDiffViewer
                oldFile={{
                    name: before.exists ? change.assetPath : "[DOES NOT EXIST]",
                    content:
                        before.exists && before.preview.kind === "text"
                            ? before.preview.content
                            : ""
                }}
                newFile={{
                    name: after.exists ? change.assetPath : "[DOES NOT EXIST]",
                    content:
                        after.exists && after.preview.kind === "text" ? after.preview.content : ""
                }}
                viewMode="split"
                size="sm"
                showLineNumbers={false}
                fileIcon={FileTextIcon}
                variant="ghost"
                className={className}
                contentClassName="max-h-[60vh] overflow-auto"
                headerMetadata={metadata}
            />
        );

    const hasImage = [before, after].some((side) => side.exists && side.preview.kind === "image");
    return (
        <div
            data-slot="asset-diff-viewer"
            className={cn(diffViewerVariants({variant: "ghost", size: "sm"}), className)}>
            <DiffViewerFrame
                oldName={change.assetPath}
                newName={change.assetPath}
                fileIcon={hasImage ? ImageIcon : FileIcon}
                metadata={metadata}>
                <div className="grid gap-4 p-4 sm:grid-cols-2">
                    <AssetSide
                        key={`before-${change.key}`}
                        label="Before"
                        side={before}
                        path={change.assetPath}
                    />
                    <AssetSide
                        key={`after-${change.key}`}
                        label="After"
                        side={after}
                        path={change.assetPath}
                    />
                </div>
                {change.comparison === "unknown" && (
                    <p className="px-4 pb-3 text-xs text-muted-foreground">
                        Content equality could not be checked. This asset is included when you
                        approve and commit.
                    </p>
                )}
            </DiffViewerFrame>
        </div>
    );
}

function AssetSide({label, side, path}: {label: string; side: AssetChangeSide; path: string}) {
    const [imageFailed, setImageFailed] = useState(false);
    let content: ReactNode;
    if (!side.exists) content = <p>File did not exist.</p>;
    else if (side.preview.kind === "text")
        content = (
            <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words">
                {side.preview.content}
            </pre>
        );
    else if (side.preview.kind === "image" && !imageFailed)
        content = (
            <img
                src={`data:${side.preview.mimeType};base64,${side.preview.contentBase64}`}
                alt={`${label}: ${path}`}
                loading="lazy"
                className="mx-auto max-h-[50vh] max-w-full object-contain"
                onError={() => setImageFailed(true)}
            />
        );
    else
        content = (
            <p role="note">
                {imageFailed
                    ? "Image preview could not be decoded."
                    : side.preview.kind === "unavailable" && side.preview.reason === "too-large"
                      ? "Preview omitted: asset exceeds the 32 MiB per-side limit."
                      : "Content preview unavailable for this file type."}{" "}
                This asset is included when you approve and commit.
            </p>
        );
    return (
        <section aria-label={`${label}: ${path}`} className="min-w-0">
            <h3 className="mb-2 font-medium">
                {label} · {formatSideSize(side)}
            </h3>
            <div className="rounded border border-dashed border-border p-4 text-sm">{content}</div>
        </section>
    );
}

function formatSideSize(side: AssetChangeSide): string {
    if (!side.exists) return "missing";
    const units = ["B", "KiB", "MiB", "GiB"];
    const index =
        side.byteLength === 0
            ? 0
            : Math.min(Math.floor(Math.log(side.byteLength) / Math.log(1024)), units.length - 1);
    const size = side.byteLength / 1024 ** index;
    return `${side.sizeIsExact ? "" : "at least "}${index ? size.toFixed(1) : size} ${units[index]}`;
}
