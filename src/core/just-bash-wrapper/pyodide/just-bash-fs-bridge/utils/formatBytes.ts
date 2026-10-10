export function formatBytes(byteLength: number): string {
    return `${byteLength / (1024 * 1024)} MiB`;
}
