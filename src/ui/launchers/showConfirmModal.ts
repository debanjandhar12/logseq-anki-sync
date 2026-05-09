import {ConfirmModalComponent} from "../modals/ConfirmModal";
import {createModalPromise} from "../modals/utils/createModalPromise";
import React from "../React";

/**
 * A confirmation modal that returns boolean based on cancel or ok button click
 */
export async function showConfirmModal(
    message: string,
    options: {
        confirmText?: string;
        cancelText?: string;
    } = {}
): Promise<boolean> {
    return createModalPromise<boolean>(
        (props) =>
            React.createElement(ConfirmModalComponent, {
                message,
                confirmText: options.confirmText,
                cancelText: options.cancelText,
                ...props
            }),
        {},
        {errorMessage: "Failed to open confirmation modal"}
    );
}
