import {logger} from "../../../logger";
import {ResultDisplayLink} from "./ResultDisplayLink";

export function SyncErrorDetailsLink({identifier, error}: {identifier: string; error: Error}) {
    return (
        <ResultDisplayLink
            variant="error"
            onClick={() => {
                logger.debug("Requested sync error details", {identifier}, error);
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
                logger.debug("Requested note deletion error details", errors);
                logseq.UI.showMsg(JSON.stringify(errors), "warning", {timeout: 0});
            }}>
            (show error details)
        </ResultDisplayLink>
    );
}
