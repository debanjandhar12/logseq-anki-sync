import type {AssistantClient, ModelContextProvider} from "@assistant-ui/react";
import {useEffect, useMemo, useRef} from "react";
import {parseTemplateString} from "../../core/template-engine/parseTemplateString";
import {createLogger, LoggerCategory} from "../../logger";
import systemMessageTemplate from "../prompts/SystemMessage.md?raw";
import {ChatToolRegistry} from "../tools";

const logger = createLogger(LoggerCategory.CHAT_UI);

export function useAssistantModelContext(aui: AssistantClient): ModelContextProvider {
    const systemPromptRef = useRef<string>();
    const toolRegistry = useMemo(() => ChatToolRegistry.getInstance(), []);

    useEffect(() => {
        const unsubscribes = Array.from(toolRegistry.getToolUIs()).map(([toolName, render]) =>
            aui.tools().setToolUI(toolName, render)
        );

        return () => {
            for (const unsubscribe of unsubscribes) {
                unsubscribe();
            }
        };
    }, [aui, toolRegistry]);

    useEffect(() => {
        const renderSystemPrompt = async () => {
            try {
                const renderedSystemPrompt = await parseTemplateString(systemMessageTemplate);
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
                ...(systemPromptRef.current ? {system: systemPromptRef.current} : {}),
                tools: toolRegistry.getTools()
            })
        }),
        [toolRegistry]
    );
}
