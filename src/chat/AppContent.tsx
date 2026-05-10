import {AuiProvider, useAui} from "@assistant-ui/react";
import {getSuggestions} from "./utils/getSuggestions";
import {CustomThread} from "./thread/CustomThread";
import React from "../ui/React";

export const AppContent = () => {
    const aui = useAui({
        suggestions: getSuggestions(),
    });

    return (
        <AuiProvider value={aui}>
            <CustomThread/>
        </AuiProvider>
    );
};