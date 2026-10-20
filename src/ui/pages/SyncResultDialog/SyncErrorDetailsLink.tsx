import {createLogger, LoggerCategory} from "../../../logger";

const logger = createLogger(LoggerCategory.UI);

export function SyncErrorDetailsLink({noteKey, error}: {noteKey: string; error: Error}) {
    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: preserve existing error-detail action semantics
        <a
            style={{fontSize: "14px", marginLeft: "5px"}}
            // biome-ignore lint/a11y/useValidAnchor: existing notification action, not URL navigation
            onClick={() => {
                logger.info(`Error object for ${noteKey}:`, error);
                logseq.UI.showMsg(
                    `Error: ${error?.message}\n\nStack trace:\n${error?.stack}`,
                    "warning",
                    {timeout: 0}
                );
            }}>
            (show error details)
        </a>
    );
}

export function DeleteErrorDetailsLink({errors}: {errors: Record<number, Error>}) {
    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: preserve existing error-detail action semantics
        <a
            style={{fontSize: "14px", marginLeft: "5px"}}
            // biome-ignore lint/a11y/useValidAnchor: existing notification action, not URL navigation
            onClick={() => {
                logger.info("Error object for all failed deletes:", errors);
                logseq.UI.showMsg(JSON.stringify(errors), "warning", {timeout: 0});
            }}>
            (show error details)
        </a>
    );
}
