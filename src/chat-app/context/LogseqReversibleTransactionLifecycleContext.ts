import {createContext, useContext} from "react";
import type {LocatedLogseqReversibleTransactionTracker} from "../tools/transaction/getLastLogseqReversibleTransactionTracker";

export interface LogseqReversibleTransactionLifecycleContextValue {
    hasTemporaryChanges: boolean;
    remainingSeconds: number | null;
    cancelScheduledRevert: () => void;
    persistTrackerArtifact: (
        locatedTracker: LocatedLogseqReversibleTransactionTracker
    ) => Promise<void>;
}

const defaultValue: LogseqReversibleTransactionLifecycleContextValue = {
    hasTemporaryChanges: false,
    remainingSeconds: null,
    cancelScheduledRevert: () => {},
    persistTrackerArtifact: async () => {}
};

export const LogseqReversibleTransactionLifecycleContext =
    createContext<LogseqReversibleTransactionLifecycleContextValue>(defaultValue);

export const useLogseqReversibleTransactionLifecycleContext = () =>
    useContext(LogseqReversibleTransactionLifecycleContext);
