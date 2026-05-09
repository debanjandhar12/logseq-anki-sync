import {ButtonModalComponent} from "../modals/ButtonModal";
import {createModalPromise} from "../modals/utils/createModalPromise";
import React from "../React";

export interface ButtonModalButton {
    name: string;
    f: Function;
    closeOnClick?: boolean;
    icon?: string;
}

/**
 * A modal that shows message along with customizable buttons.
 * @return index of button pressed (or false when canceled from top right)
 */
export async function showButtonModal(
    message: string,
    buttons: ButtonModalButton[],
    options?: {enableOutsideClickClose?: boolean}
): Promise<number | false> {
    return createModalPromise<number | false>(
        (props) => React.createElement(ButtonModalComponent, {message, buttons, ...props}),
        {enableOutsideClickClose: options?.enableOutsideClickClose},
        {errorMessage: "Failed to open button modal"}
    );
}
