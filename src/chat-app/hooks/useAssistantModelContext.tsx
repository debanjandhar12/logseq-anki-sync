import type {AssistantClient, ModelContextProvider} from "@assistant-ui/react";
import {useEffect, useMemo, useState} from "react";
import {parseTemplateString} from "../../core/template-engine/parseTemplateString";
import {createLogger, LoggerCategory} from "../../logger";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";
import systemMessageTemplate from "../prompts/SystemMessage.md?raw";
import {ChatToolRegistry} from "../tools";

const logger = createLogger(LoggerCategory.CHAT_UI);

export function useAssistantModelContext(aui: AssistantClient): ModelContextProvider {
    const [systemPrompt, setSystemPrompt] = useState<string>();
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
        let isMounted = true;

        const refreshSystemPrompt = async () => {
            try {
                const renderedSystemPrompt = await parseTemplateString(systemMessageTemplate);
                if (isMounted) setSystemPrompt(renderedSystemPrompt.trim() || undefined);
            } catch (error) {
                logger.error("Failed to render assistant system prompt", error);
            }
        };

        void refreshSystemPrompt();
        LogseqSettingAccessor.registerSettingsChangeListener(() => {
            void refreshSystemPrompt();
        });

        return () => {
            isMounted = false;
        };
    }, []);

    return useMemo(
        () => ({
            getModelContext: () => ({
                ...(systemPrompt ? {system: systemPrompt} : {}),
                tools: toolRegistry.getTools()
            })
        }),
        [systemPrompt, toolRegistry]
    );
}
