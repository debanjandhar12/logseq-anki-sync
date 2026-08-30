import React from "react";
import {createModalPromise} from "../modals/utils/createModalPromise";
import {ProviderConfigModalComponent} from "../pages/ProviderConfigModal";

export async function showProviderConfigModal(): Promise<boolean | null> {
    return createModalPromise<boolean | null>(
        (props) => React.createElement(ProviderConfigModalComponent, props),
        {},
        {errorMessage: "Failed to open provider configurations modal"}
    );
}
