import {frontendTools} from "@assistant-ui/react-ai-sdk";
import type {ChatTransport} from "ai";
import {
    type ChatRequestOptions,
    convertToModelMessages,
    streamText,
    type UIMessage,
    type UIMessageChunk
} from "ai";
import {getLLMModel} from "../../core/ai-sdk/getLLMModel.js";
import {createLogger, LoggerCategory} from "../../logger";

const logger = createLogger(LoggerCategory.CHAT_UI);

/**
 * Custom transport for supplying to AI SDK useChat hook to avoid needing a server endpoint.
 *
 * Implements the ChatTransport interface to provide local AI streaming, tools and system message support.
 *
 * Limitations:
 * (a) Currently only supports frontend tools.
 * (b) Reconnection isn't supported and doesn't make sense for local streaming.
 */
export class LocalAISDKChatTransport implements ChatTransport<UIMessage> {
    async sendMessages(
        options: {
            trigger: "submit-message" | "regenerate-message";
            chatId: string;
            messageId: string | undefined;
            messages: UIMessage[];
            abortSignal: AbortSignal | undefined;
        } & ChatRequestOptions
    ): Promise<ReadableStream<UIMessageChunk>> {
        // Get model configuration
        const model = await getLLMModel();

        // Extract system and tools from body if provided
        const body = options.body as {system?: string; tools?: Record<string, any>} | undefined;
        const system = body?.system;
        const tools = body?.tools;

        // Convert messages to model format and call AI SDK streamText
        const modelMessages = await convertToModelMessages(options.messages);
        const result = streamText({
            model,
            system,
            messages: modelMessages,
            tools: tools ? (frontendTools(tools) as any) : undefined, // pass tools
            abortSignal: options.abortSignal ?? undefined
        });

        // Return message stream
        return result.toUIMessageStream({
            messageMetadata: ({part}) => {
                if (part.type === "finish") {
                    return {
                        usage: part.totalUsage
                    };
                }
                if (part.type === "finish-step") {
                    return {
                        modelId: part.response.modelId
                    };
                }
                return undefined;
            }
        });
    }

    async reconnectToStream(
        options: {chatId: string} & ChatRequestOptions
    ): Promise<ReadableStream<UIMessageChunk> | null> {
        return null; // Reconnection isn't supported for local streaming
    }
}
