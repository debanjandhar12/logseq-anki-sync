import {useAui} from "@assistant-ui/react";
import {useCallback} from "react";
import {findLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {createLogger, LoggerCategory} from "src/logger";
import {showConfirmModal} from "src/ui/launchers/showConfirmModal";
import {usePersistLogseqTrackerArtifact} from "./usePersistLogseqTrackerArtifact";

const logger = createLogger(LoggerCategory.CHAT_UI);

const BRANCH_SWITCH_CONFIRMATION_MESSAGE =
    "The current branch has temporary changes. Do you want to revert them and switch branch?";
const BRANCH_SWITCH_ERROR_NOTIFICATION_KEY = "logseq-ai-chat-branch-switch-revert-error";
const BRANCH_SWITCH_ERROR_NOTIFICATION_TIMEOUT_MS = 10_000;

export const hasAppliedTemporaryGraphMutations = (
    tracker: {hasAppliedGraphMutations: () => boolean} | null | undefined
): boolean => !!tracker && tracker.hasAppliedGraphMutations();

export function useLogseqTemporaryChangesBranchGuard() {
    const aui = useAui();
    const persistTrackerArtifact = usePersistLogseqTrackerArtifact();

    return useCallback(async (): Promise<boolean> => {
        const messages = aui.thread().getState().messages;
        const locatedTracker = findLastLogseqReversibleTransactionTracker(messages);
        if (!hasAppliedTemporaryGraphMutations(locatedTracker?.tracker)) return true;

        const confirmed = await showConfirmModal(BRANCH_SWITCH_CONFIRMATION_MESSAGE, {
            confirmText: "Revert & Switch"
        });
        if (!confirmed) return false;

        const tracker = locatedTracker!.tracker;
        let revertErrorMessage: string | null = null;
        try {
            await tracker.revertAppliedCommands();
        } catch (error) {
            revertErrorMessage = getErrorMessageFromErrObj(error);
            logger.error(
                `Failed to revert temporary changes before branch switch: ${revertErrorMessage}`,
                error
            );
        }
        // Persist whatever revert achieved (commands kept, appliedCommandCount updated). Do not
        // navigate if persistence fails because that would leave a stale branch artifact.
        try {
            await persistTrackerArtifact(locatedTracker!);
        } catch (error) {
            logger.error("Failed to persist tracker after branch-switch revert", error);
            await showBranchSwitchError(
                "Failed to save the reverted Logseq change state. Branch switch was cancelled."
            );
            return false;
        }

        if (revertErrorMessage !== null) {
            await showBranchSwitchError(
                `Failed to revert temporary Logseq changes: ${revertErrorMessage}. Switching branch anyway; queued commands were kept.`
            );
        }
        return true;
    }, [aui, persistTrackerArtifact]);
}

async function showBranchSwitchError(message: string): Promise<void> {
    // The confirmation modal resolves before React finishes unmounting it. Waiting one frame keeps
    // the Logseq toast from being created behind the modal and immediately obscured by navigation.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
        await logseq.UI.showMsg(message, "error", {
            key: BRANCH_SWITCH_ERROR_NOTIFICATION_KEY,
            timeout: BRANCH_SWITCH_ERROR_NOTIFICATION_TIMEOUT_MS
        });
    } catch (notificationError) {
        logger.error(
            `Failed to show branch-switch error notification: ${message}`,
            notificationError
        );
    }
}
