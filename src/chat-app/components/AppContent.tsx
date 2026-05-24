import {AuiProvider, useAui} from "@assistant-ui/react";
import {ThreadWrapper} from "src/chat-app/components/ThreadWrapper";
import {getSuggestions} from "../utils/getSuggestions";

export const AppContent = () => {
    const aui = useAui({
        suggestions: getSuggestions()
    });

    return (
        <AuiProvider value={aui}>
            <ThreadWrapper />
        </AuiProvider>
    );
};
