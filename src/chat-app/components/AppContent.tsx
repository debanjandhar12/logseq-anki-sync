import {AuiProvider, Tools, useAui} from "@assistant-ui/react";
import {useEffect, useMemo} from "react";
import {ThreadWrapper} from "src/chat-app/components/ThreadWrapper";
import {useAssistantModelContext} from "src/chat-app/hooks/useAssistantModelContext";
import {useChatCommandHandler} from "src/chat-app/hooks/useChatCommandHandler";
import {ChatToolRegistry} from "src/chat-app/tools";
import {getSuggestions} from "../utils/getSuggestions";

/**
 * Registers model context and suggestions with Assistant UI.
 * @constructor
 */
export const AppContent = () => {
    const toolkit = useMemo(() => ChatToolRegistry.build().getAUIToolkit(), []);

    const aui = useAui({
        suggestions: getSuggestions(),
        tools: Tools({toolkit})
    });

    const modelContext = useAssistantModelContext(aui);
    useChatCommandHandler(aui);

    useEffect(() => {
        return aui.modelContext().register(modelContext);
    }, [aui, modelContext]);

    return (
        <AuiProvider value={aui}>
            <ThreadWrapper />
        </AuiProvider>
    );
};
