import type {ModelContextProvider} from "@assistant-ui/react";
import {useEffect, useMemo, useState} from "react";
import {parseTemplateString} from "../../core/template-engine/parseTemplateString";
import {createLogger, LoggerCategory} from "../../logger";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";
import systemMessageTemplate from "../prompts/SystemMessage.md?raw";

const logger = createLogger(LoggerCategory.CHAT_UI);

export function useAssistantModelContextProvider(): ModelContextProvider {
    const [systemPrompt, setSystemPrompt] = useState<string>();

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
            getModelContext: () => (systemPrompt ? {system: systemPrompt} : {})
        }),
        [systemPrompt]
    );
}
