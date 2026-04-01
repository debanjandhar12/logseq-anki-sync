import React from "../React";
import { createModalPromise } from "../modals/utils/createModalPromise";
import { SyncResultDialogComponent } from "../pages/SyncResultDialog";
import { SyncResult } from "../../sync/types";

export async function showSyncResultDialog(syncResult: SyncResult): Promise<SyncResult | null> {
    return createModalPromise<SyncResult | null>(
        (props) => React.createElement(SyncResultDialogComponent, { syncResult, ...props }),
        {},
        { errorMessage: "Failed to open sync result dialog" },
    );
}
