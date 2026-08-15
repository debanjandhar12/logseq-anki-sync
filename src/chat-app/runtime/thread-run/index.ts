/**
 * Thread run lifecycle and termination.
 *
 * assistant-ui message status is not a reliable adapter-run signal: a frontend tool can still be
 * executing after the message becomes requires-action. Stop therefore tracks the physical adapter
 * run and waits for runEnd before importing terminal state, preventing stale roundtrip writes.
 */

export {recoverInterruptedMessagesDuringThreadLoad} from "./recoverInterruptedMessagesDuringThreadLoad";
export {type StopThreadRunResult, stopThreadRun} from "./stopThreadRun";
export {isThreadRunActive, trackThreadRun} from "./ThreadRunTracker";
export {
    getActiveAssistantMessageTarget,
    OPERATION_INTERRUPTED_DURING_THREAD_LOAD,
    type TerminateToolTurnResult,
    type ToolTurnTarget,
    terminateToolTurn,
    USER_TERMINATED_OPERATION
} from "./terminateToolTurn";
