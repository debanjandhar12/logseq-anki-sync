import NETWORK_ALLOWLIST from "../network-allowlist.txt?raw";

const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST"]);

export function parseNetworkAllowlist(source: string): ReadonlySet<string> {
    const hosts = source
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line.length > 0 && !line.startsWith("#"));

    if (hosts.length === 0 || hosts.some((host) => !/^[a-z0-9.-]+$/.test(host))) {
        throw new Error("Network allowlist contains an invalid host.");
    }
    return new Set(hosts);
}

export const NETWORK_ALLOWLIST_HOSTS = parseNetworkAllowlist(NETWORK_ALLOWLIST);

export function assertNetworkRequestAllowed(
    input: string,
    method = "GET",
    allowedHosts: ReadonlySet<string> = NETWORK_ALLOWLIST_HOSTS
): URL {
    let url: URL;
    try {
        url = new URL(input);
    } catch {
        throw new Error(`Network access denied: invalid URL ${JSON.stringify(input)}.`);
    }

    const normalizedMethod = method.toUpperCase();
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const hostAllowed = [...allowedHosts].some(
        (host) => hostname === host || hostname.endsWith(`.${host}`)
    );
    if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        (url.port && url.port !== "443") ||
        !ALLOWED_METHODS.has(normalizedMethod) ||
        !hostAllowed
    ) {
        throw new Error(`Network access denied: ${normalizedMethod} ${url.origin}.`);
    }
    return url;
}
