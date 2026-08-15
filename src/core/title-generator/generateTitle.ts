import type {ThreadMessage} from "@assistant-ui/react";
import {generateText} from "ai";
import generateThreadTitlePrompt from "../../chat-app/prompts/GENERATE_THREAD_TITLE.md?inlineSkill";
import {createLogger, LoggerCategory} from "../../logger";
import {LogseqSettingAccessor} from "../../logseq/LogseqSettingAccessor";
import {getLLMModel} from "../ai-sdk/getLLMModel";
import {normalizeGeneratedTitle} from "./normalizeGeneratedTitle";

const logger = createLogger(LoggerCategory.CHAT_UI);

export async function generateTitle(
    remoteId: string,
    messages: readonly ThreadMessage[]
): Promise<string> {
    const fallbackTitle = `New Chat (${remoteId})`;
    const firstUserMessage = messages.find((message) => message.role === "user");
    const userText = firstUserMessage?.content
        .filter((part): part is Extract<typeof part, {type: "text"}> => part.type === "text")
        .map((part) => part.text.trim())
        .filter(Boolean)
        .join("\n");
    const selectedModelId = LogseqSettingAccessor.getPluginSettings().selectedModelId?.trim();
    const instruction = generateThreadTitlePrompt.trim();

    if (!userText || !selectedModelId || !instruction) return fallbackTitle;

    try {
        const model = await getLLMModel(selectedModelId);
        const result = await generateText({
            model,
            messages: [
                {role: "user", content: userText},
                {role: "user", content: instruction}
            ]
        });
        const title = normalizeGeneratedTitle(result.text);

        if (!title) {
            logger.warn("AI thread title output was unusable; using fallback", {remoteId});
            return fallbackTitle;
        }

        return title;
    } catch (error) {
        logger.warn("Failed to generate AI thread title; using fallback", {remoteId, error});
        return fallbackTitle;
    }
}
