import {MAX_SANDBOX_SNAPSHOT_FILE_BYTES, MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES} from "./constants";
import {SandboxSnapshotError} from "./SandboxSnapshotError";
import {formatBytes} from "./utils/formatBytes";

/** Running byte budget, local to a snapshot capture or changed-file collection. */
export class SandboxBudget {
    private totalBytes = 0;

    assertCanAdd(path: string, byteLength: number): void {
        if (byteLength > MAX_SANDBOX_SNAPSHOT_FILE_BYTES) {
            throw new SandboxSnapshotError(
                `${JSON.stringify(path)} exceeds the ${formatBytes(MAX_SANDBOX_SNAPSHOT_FILE_BYTES)} per-file limit`
            );
        }
        if (this.totalBytes + byteLength > MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES) {
            throw new SandboxSnapshotError(
                `sandbox files exceed the ${formatBytes(MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES)} total limit`
            );
        }
    }

    add(path: string, byteLength: number): void {
        this.assertCanAdd(path, byteLength);
        this.totalBytes += byteLength;
    }
}
