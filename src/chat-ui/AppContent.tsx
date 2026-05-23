import {AuiProvider, useAui} from "@assistant-ui/react";
import React from "react";
import {Thread} from "../shadcn/assistant-ui/thread";
import {getSuggestions} from "./utils/getSuggestions";

export const AppContent = () => {
    const aui = useAui({
        suggestions: getSuggestions()
    });

    return (
        <AuiProvider value={aui}>
            <Thread />
        </AuiProvider>
    );
};
