import {AuiProvider, useAui} from "@assistant-ui/react";
import React from "react";
import {CustomThread} from "./thread/CustomThread";
import {getSuggestions} from "./utils/getSuggestions";

export const AppContent = () => {
    const aui = useAui({
        suggestions: getSuggestions()
    });

    return (
        <AuiProvider value={aui}>
            <CustomThread />
        </AuiProvider>
    );
};
