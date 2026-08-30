const MAX_JWT_BYTES = 1024 * 1024;

export interface OpenAIOAuthJwtClaims {
    readonly accountId?: string;
    readonly email?: string;
    readonly expiresAt?: number;
    readonly isFedRamp?: boolean;
    readonly planType?: string;
    readonly userId?: string;
}

function optionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function decodeBase64Url(value: string): Uint8Array {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid JWT payload");
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
        value.length + ((4 - (value.length % 4)) % 4),
        "="
    );
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

// Compatibility for openai-oauth-ai-provider 0.2.1. Its Buffer-based parser produced
// "Could not decode JWT payload" for a browser device-login token. Claim extraction is
// intentionally tolerant and independent from the file-store shim; remove this when upstream
// provides equivalent browser-safe behavior. Raw tokens remain untouched by this module.
export function decodeJwtPayload(token: string): Record<string, unknown> {
    if (token.length > MAX_JWT_BYTES) throw new Error("JWT exceeds the size limit");
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) throw new Error("Invalid JWT format");
    try {
        const bytes = decodeBase64Url(parts[1]);
        if (bytes.byteLength > MAX_JWT_BYTES) throw new Error("JWT exceeds the size limit");
        const value: unknown = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
            throw new Error("JWT payload is not an object");
        }
        return value as Record<string, unknown>;
    } catch {
        throw new Error("Could not decode JWT payload");
    }
}

export function parseOpenAIOAuthJwtClaims(token: string): OpenAIOAuthJwtClaims {
    let payload: Record<string, unknown>;
    try {
        payload = decodeJwtPayload(token);
    } catch {
        return {};
    }
    const authValue = payload["https://api.openai.com/auth"];
    const profileValue = payload["https://api.openai.com/profile"];
    const auth =
        typeof authValue === "object" && authValue !== null
            ? (authValue as Record<string, unknown>)
            : undefined;
    const profile =
        typeof profileValue === "object" && profileValue !== null
            ? (profileValue as Record<string, unknown>)
            : undefined;
    const accountId = optionalString(auth?.chatgpt_account_id);
    const email = optionalString(payload.email) ?? optionalString(profile?.email);
    const planType = optionalString(auth?.chatgpt_plan_type);
    const userId = optionalString(auth?.chatgpt_user_id ?? auth?.user_id);
    const expiresAt =
        typeof payload.exp === "number" &&
        Number.isFinite(payload.exp) &&
        Number.isSafeInteger(payload.exp)
            ? payload.exp * 1000
            : undefined;
    return {
        ...(accountId ? {accountId} : {}),
        ...(email ? {email} : {}),
        ...(expiresAt === undefined ? {} : {expiresAt}),
        ...(typeof auth?.chatgpt_account_is_fedramp === "boolean"
            ? {isFedRamp: auth.chatgpt_account_is_fedramp}
            : {}),
        ...(planType ? {planType} : {}),
        ...(userId ? {userId} : {})
    };
}

export function tryGetJwtExpiration(token: string): number | undefined {
    try {
        const expiration = decodeJwtPayload(token).exp;
        return typeof expiration === "number" &&
            Number.isFinite(expiration) &&
            Number.isSafeInteger(expiration)
            ? expiration * 1000
            : undefined;
    } catch {
        return undefined;
    }
}
