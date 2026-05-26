import {AuiProvider, useAui} from "@assistant-ui/react";
import {useEffect} from "react";
import {ThreadWrapper} from "src/chat-app/components/ThreadWrapper";
import {useAssistantModelContext} from "src/chat-app/hooks/useAssistantModelContext";
import {getSuggestions} from "../utils/getSuggestions";

/**
 * Registers model context and suggestions with Assistant UI.
 * @constructor
 */
export const AppContent = () => {
    const aui = useAui({
        suggestions: getSuggestions()
    });

    const modelContext = useAssistantModelContext();

    useEffect(() => {
        return aui.modelContext().register(modelContext);
    }, [aui, modelContext]);

    return (
        <AuiProvider value={aui}>
            <ThreadWrapper />
        </AuiProvider>
    );
};
