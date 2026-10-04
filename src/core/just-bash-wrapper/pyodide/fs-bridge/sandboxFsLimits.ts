export const MAX_SANDBOX_SNAPSHOT_FILE_BYTES = 16 * 1024 * 1024;
export const MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES = 128 * 1024 * 1024;

export class SandboxSnapshotError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SandboxSnapshotError";
    }
}

export function assertFileWithinSnapshotBudget(path: string, byteLength: number): void {
    if (byteLength > MAX_SANDBOX_SNAPSHOT_FILE_BYTES) {
        throw new SandboxSnapshotError(
            `${JSON.stringify(path)} exceeds the ${formatBytes(MAX_SANDBOX_SNAPSHOT_FILE_BYTES)} per-file limit`
        );
    }
}

export function assertTotalWithinSnapshotBudget(byteLength: number): void {
    if (byteLength > MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES) {
        throw new SandboxSnapshotError(
            `sandbox files exceed the ${formatBytes(MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES)} total limit`
        );
    }
}

function formatBytes(byteLength: number): string {
    return `${byteLength / (1024 * 1024)} MiB`;
}
