import {createLogger, LoggerCategory} from "../../../logger";
import {ResultDisplayLink} from "./ResultDisplayLink";

const logger = createLogger(LoggerCategory.UI);

export function SyncErrorDetailsLink({identifier, error}: {identifier: string; error: Error}) {
    return (
        <ResultDisplayLink
            variant="error"
            onClick={() => {
                logger.info(`Error object for ${identifier}:`, error);
                logseq.UI.showMsg(
                    `Error: ${error?.message}\n\nStack trace:\n${error?.stack}`,
                    "warning",
                    {timeout: 0}
                );
            }}>
            (show error details)
        </ResultDisplayLink>
    );
}

export function DeleteErrorDetailsLink({errors}: {errors: Record<number, Error>}) {
    return (
        <ResultDisplayLink
            variant="error"
            onClick={() => {
                logger.info("Error object for all failed deletes:", errors);
                logseq.UI.showMsg(JSON.stringify(errors), "warning", {timeout: 0});
            }}>
            (show error details)
        </ResultDisplayLink>
    );
}
