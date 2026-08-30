type JwtPayload = Record<string, unknown>;

function optionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Decodes JWT payloads using browser APIs instead of Node's Buffer. */
export function decodeJwtPayload(token: string): JwtPayload {
    if (token.length > 1024 * 1024) {
        throw new Error("JWT exceeds the size limit.");
    }

    const parts = token.split(".");
    const payload = parts[1];
    if (parts.length !== 3 || !payload) {
        throw new Error("Invalid JWT format.");
    }

    try {
        const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
        const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
            throw new TypeError("JWT payload is not an object.");
        }
        return value as JwtPayload;
    } catch {
        throw new Error("Could not decode JWT payload.");
    }
}

/**
 * OpenAI can return opaque or newly encoded ID tokens. Optional claims should
 * not make an otherwise successful device authorization fail.
 */
export function parseOpenAIOAuthJwtClaims(token: string) {
    let payload: JwtPayload;
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

    return {
        ...(accountId === undefined ? {} : {accountId}),
        ...(email === undefined ? {} : {email}),
        ...(typeof payload.exp === "number" && Number.isFinite(payload.exp)
            ? {expiresAt: payload.exp * 1000}
            : {}),
        ...(typeof auth?.chatgpt_account_is_fedramp === "boolean"
            ? {isFedRamp: auth.chatgpt_account_is_fedramp}
            : {}),
        ...(planType === undefined ? {} : {planType}),
        ...(userId === undefined ? {} : {userId})
    };
}

export function tryGetJwtExpiration(token: string): number | undefined {
    try {
        const payload = decodeJwtPayload(token);
        return typeof payload.exp === "number" && Number.isFinite(payload.exp)
            ? payload.exp * 1000
            : undefined;
    } catch {
        return undefined;
    }
}
