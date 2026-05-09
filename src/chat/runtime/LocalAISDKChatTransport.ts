import { streamText, convertToModelMessages, type UIMessage, type UIMessageChunk, type ChatRequestOptions } from 'ai';
import { frontendTools } from '@assistant-ui/react-ai-sdk';
import { getLLMModel } from '../../core/ai-sdk/getLLMModel.js';
import type { ChatTransport } from 'ai';

/**
 * Custom transport that integrates streamText with useChat.
 * Implements the ChatTransport interface to provide local AI streaming
 * without requiring a server endpoint.
 */
export class LocalAISDKChatTransport implements ChatTransport<UIMessage> {
    async sendMessages(
        options: {
            trigger: 'submit-message' | 'regenerate-message';
            chatId: string;
            messageId: string | undefined;
            messages: UIMessage[];
            abortSignal: AbortSignal | undefined;
        } & ChatRequestOptions
    ): Promise<ReadableStream<UIMessageChunk>> {
        try {
            // Get model configuration
            const model = await getLLMModel();

            // Extract system and tools from body if provided
            const body = options.body as { system?: string; tools?: Record<string, any> } | undefined;
            const system = body?.system;
            const tools = body?.tools;

            // Convert messages to model format
            const modelMessages = await convertToModelMessages(options.messages);

            // Call AI SDK streamText with frontend tools support
            const result = await streamText({
                model,
                system,
                messages: modelMessages,
                tools: tools ? (frontendTools(tools) as any) : undefined,
                abortSignal: options.abortSignal ?? undefined,
            });

            // Get the UI message stream
            const stream = result.toUIMessageStream();

            return stream;
        } catch (error) {
            throw error;
        }
    }

    async reconnectToStream(
        options: { chatId: string } & ChatRequestOptions
    ): Promise<ReadableStream<UIMessageChunk> | null> {
        return null; // Reconnection not supported for local streaming
    }
}