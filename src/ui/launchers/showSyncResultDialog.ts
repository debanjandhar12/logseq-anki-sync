import type {SyncResult} from "../../sync/types";
import {createModalPromise} from "../modals/utils/createModalPromise";
import {SyncResultDialogComponent} from "../pages/SyncResultDialog";
import React from "../React";

export async function showSyncResultDialog(syncResult: SyncResult): Promise<SyncResult | null> {
    return createModalPromise<SyncResult | null>(
        (props) => React.createElement(SyncResultDialogComponent, {syncResult, ...props}),
        {},
        {errorMessage: "Failed to open sync result dialog"}
    );
}
