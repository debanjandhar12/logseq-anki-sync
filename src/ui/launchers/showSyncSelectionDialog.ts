import {createModalPromise} from "../modals/utils/createModalPromise";
import {SyncSelectionDialogComponent} from "../pages/SyncSelectionDialog";
import React from "../React";

export async function showSyncSelectionDialog(
    toCreateNotes: Array<any>,
    toUpdateNotes: Array<any>,
    toDeleteNotes: Array<any>
): Promise<{
    toCreateNotes: Array<any>;
    toUpdateNotes: Array<any>;
    toDeleteNotes: Array<any>;
} | null> {
    return createModalPromise<{
        toCreateNotes: Array<any>;
        toUpdateNotes: Array<any>;
        toDeleteNotes: Array<any>;
    } | null>(
        (props) =>
            React.createElement(SyncSelectionDialogComponent, {
                toCreateNotes,
                toUpdateNotes,
                toDeleteNotes,
                ...props
            }),
        {},
        {errorMessage: "Failed to open sync selection dialog"}
    );
}
