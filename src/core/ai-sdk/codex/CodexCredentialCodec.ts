import type {OpenAIOAuthTokens} from "openai-oauth-ai-provider/core";
import {z} from "zod";

const MAX_CREDENTIAL_BYTES = 1024 * 1024;
const tokenSchema = z
    .object({
        accessToken: z.string().min(1),
        idToken: z.string().min(1),
        refreshToken: z.string().min(1),
        updatedAt: z.number().finite(),
        accountId: z.string().min(1).optional(),
        planType: z.string().min(1).optional(),
        isFedRamp: z.boolean().optional()
    })
    .strict();
const envelopeSchema = z
    .object({
        version: z.literal(1),
        provider: z.literal("openai-oauth-ai-provider"),
        tokens: tokenSchema
    })
    .strict();

function bytesToBinary(bytes: Uint8Array): string {
    let result = "";
    for (const byte of bytes) result += String.fromCharCode(byte);
    return result;
}

function invalidCredentials(): Error {
    return new Error("Codex Subscription credentials are invalid");
}

function getAccessTokenAccountId(accessToken: string): string | undefined {
    try {
        const payloadPart = accessToken.split(".")[1];
        if (!payloadPart) return undefined;
        const padded = payloadPart
            .replaceAll("-", "+")
            .replaceAll("_", "/")
            .padEnd(payloadPart.length + ((4 - (payloadPart.length % 4)) % 4), "=");
        const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
        const payload = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes)) as Record<
            string,
            unknown
        >;
        const auth = payload["https://api.openai.com/auth"];
        if (typeof auth !== "object" || auth === null) return undefined;
        const accountId = (auth as Record<string, unknown>).chatgpt_account_id;
        return typeof accountId === "string" && accountId.length > 0 ? accountId : undefined;
    } catch {
        return undefined;
    }
}

export function normalizeCodexTokens(tokens: OpenAIOAuthTokens): OpenAIOAuthTokens {
    if (tokens.accountId) return tokens;
    const accountId = getAccessTokenAccountId(tokens.accessToken);
    return accountId ? {...tokens, accountId} : tokens;
}

export function encodeCodexCredentials(tokens: OpenAIOAuthTokens): string {
    try {
        const envelope = envelopeSchema.parse({
            version: 1,
            provider: "openai-oauth-ai-provider",
            tokens: normalizeCodexTokens(tokens)
        });
        const bytes = new TextEncoder().encode(JSON.stringify(envelope));
        if (bytes.byteLength > MAX_CREDENTIAL_BYTES) throw invalidCredentials();
        return btoa(bytesToBinary(bytes));
    } catch {
        throw invalidCredentials();
    }
}

export function decodeCodexCredentials(encoded: string): OpenAIOAuthTokens {
    try {
        if (!encoded || encoded.length > MAX_CREDENTIAL_BYTES * 2) throw invalidCredentials();
        const binary = atob(encoded);
        if (binary.length > MAX_CREDENTIAL_BYTES) throw invalidCredentials();
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const json = new TextDecoder("utf-8", {fatal: true}).decode(bytes);
        return normalizeCodexTokens(envelopeSchema.parse(JSON.parse(json)).tokens);
    } catch {
        throw invalidCredentials();
    }
}

export function isValidCodexCredentials(encoded: string): boolean {
    try {
        decodeCodexCredentials(encoded);
        return true;
    } catch {
        return false;
    }
}
