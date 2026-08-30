import {z} from "zod";
import {isValidCodexCredentials} from "../codex/CodexCredentialCodec";
import {ProviderTypeEnum} from "../types";
import {DEFAULT_CODEX_BASE_URL} from "./constants";
import {SELECTED_MODEL_ID_DELIMITER} from "./selectedModelId";
import {validateProviderBaseUrl} from "./validateProviderConfig";

export const providerModelConfigSchema = z
    .object({
        id: z.string().trim().min(1),
        enabled: z.boolean()
    })
    .strict();

export const providerConfigSchema = z
    .object({
        id: z
            .string()
            .trim()
            .min(1)
            .refine((id) => id === id.toLowerCase())
            .refine((id) => !id.includes(SELECTED_MODEL_ID_DELIMITER)),
        type: z.enum(ProviderTypeEnum),
        baseUrl: z.string().refine((baseUrl) => {
            try {
                validateProviderBaseUrl(baseUrl);
                return true;
            } catch {
                return false;
            }
        }),
        apiKey: z.string(),
        models: z.array(providerModelConfigSchema)
    })
    .strict()
    .superRefine((config, context) => {
        if (config.type === ProviderTypeEnum.CODEX_SUBSCRIPTION) {
            let baseUrl: string | undefined;
            try {
                baseUrl = validateProviderBaseUrl(config.baseUrl);
            } catch {
                // The field-level validation reports this error.
            }
            if (baseUrl !== DEFAULT_CODEX_BASE_URL) {
                context.addIssue({
                    code: "custom",
                    path: ["baseUrl"],
                    message: "Codex Subscription Base URL is fixed"
                });
            }
            if (config.apiKey && !isValidCodexCredentials(config.apiKey)) {
                context.addIssue({
                    code: "custom",
                    path: ["apiKey"],
                    message: "Codex Subscription credentials are invalid"
                });
            }
        } else if (!config.apiKey.trim()) {
            context.addIssue({
                code: "custom",
                path: ["apiKey"],
                message: "Provider API key is required"
            });
        }
    });

export const providerConfigsSchema = z
    .array(providerConfigSchema)
    .superRefine((configs, context) => {
        const seenIds = new Set<string>();
        for (const [configIndex, config] of configs.entries()) {
            if (seenIds.has(config.id)) {
                context.addIssue({
                    code: "custom",
                    path: [configIndex, "id"],
                    message: "Provider configuration IDs must be unique"
                });
            }
            seenIds.add(config.id);

            const seenModelIds = new Set<string>();
            for (const [modelIndex, model] of config.models.entries()) {
                if (seenModelIds.has(model.id)) {
                    context.addIssue({
                        code: "custom",
                        path: [configIndex, "models", modelIndex, "id"],
                        message: "Model IDs must be unique within a provider configuration"
                    });
                }
                seenModelIds.add(model.id);
            }

            if (
                !config.models.some((model) => model.enabled) &&
                !(config.type === ProviderTypeEnum.CODEX_SUBSCRIPTION && config.apiKey.length === 0)
            ) {
                context.addIssue({
                    code: "custom",
                    path: [configIndex, "models"],
                    message: "At least one model must be enabled"
                });
            }
        }
    });
