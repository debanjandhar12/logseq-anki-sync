import {ResultSectionHeading} from "./ResultSectionHeading";
import {SyncErrorDetailsLink} from "./SyncErrorDetailsLink";

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
    return (
        <span className="inline-flex items-center flex-wrap" style={{fontSize: "14px"}}>
            <span
                className={error ? "text-danger" : "text-success"}
                style={{userSelect: "none"}}
                title={error ? "Sync Failed" : "Synced Successfully"}>
                {error ? "⚠" : "✓"}
            </span>
            <a className="ml-1 break-all" href={url} title={url} target="_blank" rel="noreferrer">
                {getAssetFilename(url)}
            </a>
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
