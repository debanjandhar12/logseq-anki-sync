import React from "../React";
import { createModalPromise } from "../modals/utils/createModalPromise";
import { SelectionModalComponent } from "../modals/SelectionModal";

export interface SelectionModalItem {
    name: string;
    icon?: string;
}

/**
 * Enhanced selection modal with standardized API
 */
export async function showSelectionModal(
    items: SelectionModalItem[],
    options: {
        message: string;
        enableKeySelect?: boolean;
    } = { message: "" },
): Promise<number | null> {
    return createModalPromise<number | null>(
        (props) => (
            React.createElement(SelectionModalComponent, {
                items,
                message: options.message,
                enableKeySelect: options.enableKeySelect,
                ...props,
            })
        ),
        {},
        { errorMessage: "Failed to open selection modal" },
    );
}
