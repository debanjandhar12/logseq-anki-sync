import {getPathForPassingToAnki} from "../../../anki-connect/operations/utils/getPathForPassingToAnki";
import {createLogger, LoggerCategory} from "../../../logger";
import {WindowParentBridge} from "../../../logseq/WindowParentBridge";
import {LogseqTooltip} from "../../components/LogseqTooltip";
import {ResultDisplayLink} from "./ResultDisplayLink";
import {ResultSectionHeading} from "./ResultSectionHeading";
import {SyncErrorDetailsLink} from "./SyncErrorDetailsLink";

const logger = createLogger(LoggerCategory.UI);

function getAssetFilename(sourceUrl: string): string {
    let pathname = sourceUrl;
    try {
        const url = new URL(sourceUrl);
        pathname = url.pathname || url.hostname;
    } catch {
        // Native paths may not be valid URLs.
    }
    const filename = pathname.replace(/\\/g, "/").split("/").pop() || sourceUrl;
    try {
        return decodeURIComponent(filename);
    } catch {
        return filename;
    }
}

function AssetResultLine({url, error}: {url: string; error?: Error}) {
    const isBrowserAsset = /^(https?:|blob:|data:)/i.test(url);
    const openLocalAsset = async () => {
        try {
            const nativePath = getPathForPassingToAnki(url);
            if (nativePath === null) throw new Error(`Unable to resolve local asset: ${url}`);
            await WindowParentBridge.openPath(nativePath);
        } catch (error) {
            logger.error("Failed to open asset", {url, error});
            void logseq.UI.showMsg(
                `Unable to open asset: ${error instanceof Error ? error.message : String(error)}`,
                "warning"
            );
        }
    };
    return (
        <span className="inline-flex items-center flex-wrap" style={{fontSize: "14px"}}>
            <span
                className={error ? "text-danger" : "text-success"}
                style={{userSelect: "none"}}
                title={error ? "Sync Failed" : "Synced Successfully"}>
                {error ? "⚠" : "✓"}
            </span>
            <LogseqTooltip content={url}>
                <ResultDisplayLink
                    href={isBrowserAsset ? url : undefined}
                    onClick={isBrowserAsset ? undefined : () => void openLocalAsset()}>
                    {getAssetFilename(url)}
                </ResultDisplayLink>
            </LogseqTooltip>
            {error && <SyncErrorDetailsLink identifier={url} error={error} />}
        </span>
    );
}

export function SyncedAssetsSection({
    assets = [],
    failures = {}
}: {
    assets?: string[];
    failures?: Record<string, Error>;
}) {
    return (
        <>
            <ResultSectionHeading title="Synced Assets" />
            {assets.length === 0 && Object.keys(failures).length === 0 && (
                <span style={{fontSize: "14px"}}>No assets were synced.</span>
            )}
            {assets
                .filter((url) => !failures[url])
                .map((url) => (
                    <AssetResultLine key={url} url={url} />
                ))}
            {Object.entries(failures).map(([url, error]) => (
                <AssetResultLine key={url} url={url} error={error} />
            ))}
        </>
    );
}
