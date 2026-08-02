import {useAui} from "@assistant-ui/react";
import {useCallback} from "react";
import {findLastLogseqReversibleTransactionTracker} from "src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {getErrorMessageFromErrObj} from "src/chat-app/utils/getErrorMessageFromErrObj";
import {createLogger, LoggerCategory} from "src/logger";
import {showConfirmModal} from "src/ui/launchers/showConfirmModal";
import {usePersistLogseqTrackerArtifact} from "./usePersistLogseqTrackerArtifact";

const logger = createLogger(LoggerCategory.CHAT_UI);

const BRANCH_SWITCH_CONFIRMATION_MESSAGE =
    "The current branch has uncommited changes. Do you want to revert and switch branch?";

export const hasUncommittedGraphMutations = (
    tracker: {hasAppliedGraphMutations: () => boolean} | null | undefined
): boolean => !!tracker && tracker.hasAppliedGraphMutations();

export function useLogseqUncommittedChangesBranchGuard() {
    const aui = useAui();
    const persistTrackerArtifact = usePersistLogseqTrackerArtifact();

    return useCallback(async (): Promise<boolean> => {
        const messages = aui.thread().getState().messages;
        const locatedTracker = findLastLogseqReversibleTransactionTracker(messages);
        if (!hasUncommittedGraphMutations(locatedTracker?.tracker)) return true;

        const confirmed = await showConfirmModal(BRANCH_SWITCH_CONFIRMATION_MESSAGE, {
            confirmText: "Revert & Switch"
        });
        if (!confirmed) return false;

        const tracker = locatedTracker!.tracker;
        try {
            await tracker.revertAppliedCommands();
        } catch (error) {
            logger.error("Failed to revert uncommitted changes before branch switch", error);
            try {
                await logseq.UI.showMsg(
                    `Failed to revert uncommitted Logseq changes: ${getErrorMessageFromErrObj(
                        error
                    )}. Switching branch anyway; staged commands were kept.`,
                    "error"
                );
            } catch (notificationError) {
                logger.error("Failed to show branch-switch revert error", notificationError);
            }
        }
        // Persist whatever revert achieved (commands kept, appliedCommandCount updated). Do not
        // navigate if persistence fails because that would leave a stale branch artifact.
        try {
            await persistTrackerArtifact(locatedTracker!);
        } catch (error) {
            logger.error("Failed to persist tracker after branch-switch revert", error);
            try {
                await logseq.UI.showMsg(
                    "Failed to save the reverted Logseq change state. Branch switch was cancelled.",
                    "error"
                );
            } catch (notificationError) {
                logger.error("Failed to show tracker persistence error", notificationError);
            }
            return false;
        }
        return true;
    }, [aui, persistTrackerArtifact]);
}
