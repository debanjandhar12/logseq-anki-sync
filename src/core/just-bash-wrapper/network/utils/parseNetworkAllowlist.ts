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
