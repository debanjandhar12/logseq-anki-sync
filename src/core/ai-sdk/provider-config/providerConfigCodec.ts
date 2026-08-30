import type {ProviderConfig} from "../types";
import {providerConfigsSchema} from "./providerConfigSchema";

function bytesToBinary(bytes: Uint8Array): string {
    let result = "";
    for (const byte of bytes) result += String.fromCharCode(byte);
    return result;
}

export function encodeProviderConfigs(configs: ProviderConfig[]): string {
    const validated = providerConfigsSchema.parse(configs);
    return btoa(bytesToBinary(new TextEncoder().encode(JSON.stringify(validated))));
}

export function decodeProviderConfigs(encoded: string): ProviderConfig[] {
    try {
        const binary = atob(encoded);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const json = new TextDecoder("utf-8", {fatal: true}).decode(bytes);
        return providerConfigsSchema.parse(JSON.parse(json));
    } catch {
        throw new Error("Stored provider configurations are invalid");
    }
}
