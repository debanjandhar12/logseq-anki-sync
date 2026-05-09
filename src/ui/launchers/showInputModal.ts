import {InputModalComponent} from "../modals/InputModal";
import {createModalPromise} from "../modals/utils/createModalPromise";
import React from "../React";

/**
 * Shows an input modal for text entry.
 *
 * @param options - Modal options
 * @param options.title - Optional title for the modal
 * @param options.message - Optional message/description
 * @param options.placeholder - Placeholder text for the input field
 * @param options.initialValue - Initial value in the input field
 * @param options.maxLength - Optional maximum character length (counter shown only when provided)
 * @returns The entered string, or null if cancelled
 */
export async function showInputModal(
    options: {
        title?: string;
        message?: string;
        placeholder?: string;
        initialValue?: string;
        maxLength?: number;
    } = {}
): Promise<string | null> {
    return createModalPromise<string | null>(
        (props) =>
            React.createElement(InputModalComponent, {
                title: options.title,
                message: options.message,
                placeholder: options.placeholder,
                initialValue: options.initialValue,
                maxLength: options.maxLength,
                ...props
            }),
        {},
        {errorMessage: "Failed to open input modal"}
    );
}
