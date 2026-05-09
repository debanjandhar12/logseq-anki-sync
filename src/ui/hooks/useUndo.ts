import React from "../React";

export enum ActionType {
    Undo = "UNDO",
    Redo = "REDO",
    Set = "SET",
    Reset = "RESET"
}

export interface State<T> {
    past: T[];
    present: T;
    future: T[];
}

export type Action<T> =
    | {type: ActionType.Undo}
    | {type: ActionType.Redo}
    | {type: ActionType.Set; newPresent: T; historyCheckpoint?: boolean}
    | {type: ActionType.Reset; newPresent: T};

export const initialState = {
    past: [],
    present: null as any,
    future: []
};

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
    const {past, present, future} = state;

    switch (action.type) {
        case ActionType.Undo: {
            if (past.length === 0) {
                return state;
            }
            const previous = past[past.length - 1];
            const newPast = past.slice(0, past.length - 1);
            return {
                past: newPast,
                present: previous,
                future: [present, ...future]
            };
        }

        case ActionType.Redo: {
            if (future.length === 0) {
                return state;
            }
            const next = future[0];
            const newFuture = future.slice(1);
            return {
                past: [...past, present],
                present: next,
                future: newFuture
            };
        }

        case ActionType.Set: {
            const isNewCheckpoint = action.historyCheckpoint !== false;
            const {newPresent} = action;

            if (newPresent === present) {
                return state;
            }

            return {
                past: !isNewCheckpoint ? past : [...past, present],
                present: newPresent,
                future: []
            };
        }

        case ActionType.Reset: {
            const {newPresent} = action;
            return {
                past: [],
                present: newPresent,
                future: []
            };
        }
    }
}

export interface UseUndoOptions {
    useCheckpoints?: boolean;
}

export interface UseUndoActions<T> {
    set: (newPresent: T, checkpoint?: boolean) => void;
    reset: (newPresent: T) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

export function useUndo<T>(
    initialPresent: T,
    opts: UseUndoOptions = {}
): [State<T>, UseUndoActions<T>] {
    const {useCheckpoints = false} = opts;

    const [state, dispatch] = React.useReducer(
        reducer as React.Reducer<State<T>, Action<T>>,
        {
            ...initialState,
            present: initialPresent
        } as State<T>
    );

    const canUndo = state.past.length !== 0;
    const canRedo = state.future.length !== 0;

    const undo = React.useCallback(() => {
        if (canUndo) {
            dispatch({type: ActionType.Undo});
        }
    }, [canUndo]);

    const redo = React.useCallback(() => {
        if (canRedo) {
            dispatch({type: ActionType.Redo});
        }
    }, [canRedo]);

    const set = React.useCallback(
        (newPresent: T, checkpoint: boolean = false) => {
            dispatch({
                type: ActionType.Set,
                newPresent,
                historyCheckpoint: useCheckpoints ? checkpoint : true
            });
        },
        [useCheckpoints]
    );

    const reset = React.useCallback((newPresent: T) => {
        dispatch({type: ActionType.Reset, newPresent});
    }, []);

    return [state, {set, reset, undo, redo, canUndo, canRedo}];
}

export default useUndo;
