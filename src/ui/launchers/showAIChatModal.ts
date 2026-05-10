import React from "react";
import {AIChatModalComponent} from "../modals/AIChatModal";
import {createModalPromise} from "../modals/utils/createModalPromise";

/**
 * Opens the AI Chat modal in development mode.
 * @param chatComponent - The React component to render inside the modal
 * @returns Promise that resolves when the modal is closed
 */
export async function showAIChatModal(chatComponent: React.ReactElement): Promise<void> {
    return createModalPromise<void>(
        (props) => React.createElement(AIChatModalComponent, {chatComponent, ...props}),
        {enableOutsideClickClose: false},
        {errorMessage: "Failed to open AI chat-ui modal"}
    );
}
