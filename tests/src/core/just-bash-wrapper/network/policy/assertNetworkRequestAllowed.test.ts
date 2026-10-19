import {describe, expect, test} from "vitest";
import {
    assertNetworkRequestAllowed,
    parseNetworkAllowlist
} from "../../../../../../src/core/just-bash-wrapper/network";
import NETWORK_ALLOWLIST from "../../../../../../src/core/just-bash-wrapper/network/network-allowlist.txt?raw";

describe("network policy", () => {
    const hosts = parseNetworkAllowlist("# comment\nexample.com\n");
    const localHosts = parseNetworkAllowlist("localhost\n127.0.0.1");

    test.each(["localhost", "127.0.0.1"])("allows explicit local host %s on any port", (host) => {
        for (const scheme of ["http", "https"]) {
            for (const port of ["", ":3000", ":12315", ":65535"]) {
                for (const method of ["GET", "HEAD", "POST"]) {
                    expect(
                        assertNetworkRequestAllowed(
                            `${scheme}://${host}${port}/api`,
                            method,
                            localHosts
                        ).hostname
                    ).toBe(host);
                }
            }
        }
    });

    test.each([
        "http://api.localhost:3000",
        "https://api.localhost",
        "http://localhost.example.com",
        "https://service.127.0.0.1",
        "http://127.0.0.2",
        "http://[::1]",
        "https://[::1]",
        "https://192.168.1.1",
        "http://user:password@localhost",
        "ftp://localhost"
    ])("rejects local near-misses and unsafe transports: %s", (url) => {
        expect(() => assertNetworkRequestAllowed(url, "GET", localHosts)).toThrow(
            /Network access denied/
        );
    });

    test("requires exact local entries in the supplied policy", () => {
        for (const host of localHosts) {
            expect(() => assertNetworkRequestAllowed(`https://${host}`, "GET", hosts)).toThrow();
        }
    });

    test.each([
        "127.1",
        "2130706433",
        "0x7f000001"
    ])("uses URL canonicalization for loopback alias %s", (host) => {
        expect(assertNetworkRequestAllowed(`http://${host}:3000`, "GET", localHosts).hostname).toBe(
            "127.0.0.1"
        );
    });

    test("ships a deduplicated expanded policy with the requested services", () => {
        const shippedHosts = parseNetworkAllowlist(NETWORK_ALLOWLIST);
        const entries = NETWORK_ALLOWLIST.split(/\r?\n/).filter(
            (line) => line.trim() && !line.trim().startsWith("#")
        );
        expect(shippedHosts.size).toBe(entries.length);
        expect(shippedHosts.size).toBeGreaterThanOrEqual(233);
        expect(shippedHosts.size).toBeLessThanOrEqual(333);
        for (const host of [
            "crates.io",
            "hub.docker.com",
            "registry-1.docker.io",
            "gitlab.com",
            "chatgpt.com",
            "chatgpt.com/codex",
            "claude.ai",
            "khanacademy.org",
            "coursera.org",
            "unacademy.com",
            "udemy.com",
            "files.pythonhosted.org",
            "medium.com",
            "newsletter.substack.com",
            "example.wordpress.com",
            "example.blogspot.com",
            "blogger.com",
            "hashnode.com",
            "example.hashnode.dev",
            "example.ghost.io",
            "tumblr.com",
            "smashingmagazine.com"
        ]) {
            expect(assertNetworkRequestAllowed(`https://${host}`).protocol).toBe("https:");
        }
    });

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
        expect(() =>
            assertNetworkRequestAllowed("https://example.com.attacker.test", "GET", hosts)
        ).toThrow();
        expect(() => assertNetworkRequestAllowed("https://example.com", "PUT", hosts)).toThrow();
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
