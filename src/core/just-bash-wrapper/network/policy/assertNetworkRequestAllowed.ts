import NETWORK_ALLOWLIST from "../network-allowlist.txt?raw";
import {parseNetworkAllowlist} from "./parseNetworkAllowlist";

const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST"]);

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
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
    const hostAllowed = isLocalHost
        ? allowedHosts.has(hostname)
        : [...allowedHosts].some(
              (host) =>
                  host !== "localhost" &&
                  host !== "127.0.0.1" &&
                  (hostname === host || hostname.endsWith(`.${host}`))
          );
    const transportAllowed = isLocalHost
        ? url.protocol === "http:" || url.protocol === "https:"
        : url.protocol === "https:" && (!url.port || url.port === "443");
    if (
        !transportAllowed ||
        url.username ||
        url.password ||
        !ALLOWED_METHODS.has(normalizedMethod) ||
        !hostAllowed
    ) {
        throw new Error(`Network access denied: ${normalizedMethod} ${url.origin}.`);
    }
    return url;
}
