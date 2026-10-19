export function parseNetworkAllowlist(source: string): ReadonlySet<string> {
    const hosts = new Set<string>();
    for (const [index, line] of source.split(/\r?\n/).entries()) {
        const host = line.trim().toLowerCase();
        if (!host || host.startsWith("#")) continue;

        const validDomain =
            host.length <= 253 &&
            host.includes(".") &&
            /[a-z]/.test(host.split(".").at(-1) ?? "") &&
            host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
        if (host !== "localhost" && host !== "127.0.0.1" && !validDomain) {
            throw new Error(`Network allowlist contains an invalid host at line ${index + 1}.`);
        }
        hosts.add(host);
    }
    if (hosts.size === 0) throw new Error("Network allowlist contains an invalid host.");
    return hosts;
}
