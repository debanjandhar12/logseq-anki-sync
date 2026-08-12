import type {ThreadMessage} from "@assistant-ui/react";
import {type LlamaContextWrapper, loadModel} from "@fugood/node-llama-wasm";
import {createLogger, LoggerCategory} from "../../logger";
import titleModelUrl from "./models/SupraTitle-50M-Q1_0.gguf?url";

const logger = createLogger(LoggerCategory.MISC);
let titleModelPromise: Promise<LlamaContextWrapper> | undefined;

const getTitleModel = (): Promise<LlamaContextWrapper> => {
    titleModelPromise ??= loadModel({
        model: titleModelUrl,
        n_ctx: 5120,
        n_threads: 1,
        n_gpu_layers: 0,
        wasm: {
            worker: false,
            threads: false,
            cacheDownloads: false
        }
    });
    return titleModelPromise;
};

export const generateTitle = async (
    remoteId: string,
    messages: readonly ThreadMessage[]
): Promise<string> => {
    const firstUserMessage = messages.find((message) => message.role === "user");
    const userMessage = firstUserMessage?.content
        .flatMap((part) => ("text" in part ? [part.text] : []))
        .join("\n\n")
        .trim();
    if (!userMessage) return remoteId;

    try {
        const titleModel = await getTitleModel();
        const result = await titleModel.completion({
            prompt: `User: ${userMessage}\nTitle: `,
            n_predict: 24,
            temperature: 0.4,
            top_k: 40,
            top_p: 0.85,
            penalty_repeat: 1.2,
            stop: ["</s>"]
        });
        return result.text.trim() || remoteId;
    } catch (error) {
        logger.error("Failed to generate local thread title", error);
        return remoteId;
    }
};
