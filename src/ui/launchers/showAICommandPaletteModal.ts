import React from "react";
import type {UserCommand} from "../../core/user-commands-init";
import {createModalPromise} from "../modals/utils/createModalPromise";
import {AICommandPaletteModalComponent} from "../pages/AICommandPaletteModal";

export function showAICommandPaletteModal(
    commands: readonly UserCommand[]
): Promise<UserCommand | null> {
    return createModalPromise<UserCommand | null>(
        (props) => React.createElement(AICommandPaletteModalComponent, {...props, commands}),
        {},
        {errorMessage: "Failed to open the AI command palette"}
    );
}
