import type {AssistantClient, ModelContextProvider} from "@assistant-ui/react";
import {useEffect, useMemo, useRef} from "react";
import {parseTemplateString} from "../../core/template-engine/parseTemplateString";
import {createLogger, LoggerCategory} from "../../logger";
import mainSystemMessageTemplate from "../prompts/MAIN_SYSTEM_MESSAGE.md?inlineSkill";

const logger = createLogger(LoggerCategory.CHAT_UI);

export function useAssistantModelContext(aui: AssistantClient): ModelContextProvider {
    const systemPromptRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        const renderSystemPrompt = async () => {
            try {
                const renderedSystemPrompt = await parseTemplateString(mainSystemMessageTemplate);
                systemPromptRef.current = renderedSystemPrompt.trim() || undefined;
            } catch (error) {
                logger.error("Failed to render assistant system prompt", error);
            }
        };

        const refreshSystemPrompt = () => {
            if (aui.thread().getState().isRunning) return;
            void renderSystemPrompt();
        };

        refreshSystemPrompt();
        const intervalId = window.setInterval(refreshSystemPrompt, 4000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [aui]);

    return useMemo(
        () => ({
            getModelContext: () => ({
                ...(systemPromptRef.current ? {system: systemPromptRef.current} : {})
            })
        }),
        []
    );
}
