import {z} from "zod";
import {ProviderTypeEnum} from "../types";
import {DEFAULT_CODEX_BASE_URL} from "./constants";
import {validateProviderBaseUrl} from "./validateProviderConfig";

export const providerModelConfigSchema = z
    .object({
        id: z.string().trim().min(1),
        enabled: z.boolean()
    })
    .strict();

const providerConfigBaseSchema = z.object({
    uuid: z.uuid(),
    name: z.string().trim().min(1),
    baseUrl: z.string().refine((baseUrl) => {
        try {
            validateProviderBaseUrl(baseUrl);
            return true;
        } catch {
            return false;
        }
    }),
    models: z.array(providerModelConfigSchema)
});

const apiKeyProviderConfigSchema = providerConfigBaseSchema
    .extend({
        type: z.enum([
            ProviderTypeEnum.OPENAI,
            ProviderTypeEnum.OPENAI_COMPATIBLE,
            ProviderTypeEnum.GOOGLE
        ]),
        apiKey: z.string().trim().min(1)
    })
    .strict();

const oauthProviderConfigSchema = providerConfigBaseSchema
    .extend({
        type: z.literal(ProviderTypeEnum.CODEX_SUBSCRIPTION),
        oauthStorage: z.record(z.string(), z.string())
    })
    .strict()
    .superRefine((config, context) => {
        if (Object.keys(config.oauthStorage).length === 0) {
            context.addIssue({
                code: "custom",
                path: ["oauthStorage"],
                message: "OAuth authentication is required"
            });
        }
        let baseUrl: string | undefined;
        try {
            baseUrl = validateProviderBaseUrl(config.baseUrl);
        } catch {
            return;
        }
        if (baseUrl !== DEFAULT_CODEX_BASE_URL) {
            context.addIssue({
                code: "custom",
                path: ["baseUrl"],
                message: "Codex Subscription Base URL is fixed"
            });
        }
    });

export const providerConfigSchema = z.discriminatedUnion("type", [
    apiKeyProviderConfigSchema,
    oauthProviderConfigSchema
]);

export const providerConfigsSchema = z
    .array(providerConfigSchema)
    .superRefine((configs, context) => {
        const seenUuids = new Set<string>();
        const seenNames = new Set<string>();
        for (const [configIndex, config] of configs.entries()) {
            if (seenUuids.has(config.uuid)) {
                context.addIssue({
                    code: "custom",
                    path: [configIndex, "uuid"],
                    message: "Provider configuration UUIDs must be unique"
                });
            }
            seenUuids.add(config.uuid);

            const normalizedName = config.name.toLocaleLowerCase();
            if (seenNames.has(normalizedName)) {
                context.addIssue({
                    code: "custom",
                    path: [configIndex, "name"],
                    message: "Provider configuration names must be unique"
                });
            }
            seenNames.add(normalizedName);

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

            if (!config.models.some((model) => model.enabled)) {
                context.addIssue({
                    code: "custom",
                    path: [configIndex, "models"],
                    message: "At least one model must be enabled"
                });
            }
        }
    });
