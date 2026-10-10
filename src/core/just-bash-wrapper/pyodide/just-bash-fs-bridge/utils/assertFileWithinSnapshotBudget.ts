import {MAX_SANDBOX_SNAPSHOT_FILE_BYTES} from "../constants";
import {formatBytes} from "./formatBytes";
import {SandboxSnapshotError} from "./SandboxSnapshotError";

export function assertFileWithinSnapshotBudget(path: string, byteLength: number): void {
    if (byteLength > MAX_SANDBOX_SNAPSHOT_FILE_BYTES) {
        throw new SandboxSnapshotError(
            `${JSON.stringify(path)} exceeds the ${formatBytes(MAX_SANDBOX_SNAPSHOT_FILE_BYTES)} per-file limit`
        );
    }
}
