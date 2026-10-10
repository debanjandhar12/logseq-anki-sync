import {describe, expect, test} from "vitest";
import {
    assertNetworkRequestAllowed,
    parseNetworkAllowlist
} from "../../../../../src/core/just-bash-wrapper/network";

describe("network policy", () => {
    const hosts = parseNetworkAllowlist("# comment\nexample.com\n");

    test("allows apex hosts and subdomains", () => {
        expect(assertNetworkRequestAllowed("https://example.com/a", "GET", hosts).hostname).toBe(
            "example.com"
        );
        expect(
            assertNetworkRequestAllowed("https://api.example.com/a", "POST", hosts).hostname
        ).toBe("api.example.com");
    });

    test("rejects lookalikes, insecure URLs, credentials, ports, and write methods", () => {
        expect(() => assertNetworkRequestAllowed("https://notexample.com", "GET", hosts)).toThrow();
        expect(() => assertNetworkRequestAllowed("http://example.com", "GET", hosts)).toThrow();
        expect(() =>
            assertNetworkRequestAllowed("https://user@example.com", "GET", hosts)
        ).toThrow();
        expect(() =>
            assertNetworkRequestAllowed("https://example.com:444", "GET", hosts)
        ).toThrow();
        expect(() => assertNetworkRequestAllowed("https://example.com", "DELETE", hosts)).toThrow();
    });

    test("rejects malformed URLs with the existing error message", () => {
        expect(() => assertNetworkRequestAllowed("not a URL", "GET", hosts)).toThrow(
            'Network access denied: invalid URL "not a URL".'
        );
    });

    test("allows lowercase methods and normalizes the URL hostname", () => {
        expect(assertNetworkRequestAllowed("https://EXAMPLE.COM/a", "get", hosts).href).toBe(
            "https://example.com/a"
        );
    });

    test("allows the explicit default HTTPS port", () => {
        const url = assertNetworkRequestAllowed("https://example.com:443/a", "GET", hosts);
        expect(url.href).toBe("https://example.com/a");
        expect(url.port).toBe("");
    });

    test("allows trailing-dot hostnames while retaining the dot in the returned URL", () => {
        expect(assertNetworkRequestAllowed("https://example.com./a", "GET", hosts).hostname).toBe(
            "example.com."
        );
        expect(
            assertNetworkRequestAllowed("https://api.example.com./a", "GET", hosts).hostname
        ).toBe("api.example.com.");
    });
});
