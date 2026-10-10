import {MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES} from "../constants";
import {formatBytes} from "./formatBytes";
import {SandboxSnapshotError} from "./SandboxSnapshotError";

export function assertTotalWithinSnapshotBudget(byteLength: number): void {
    if (byteLength > MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES) {
        throw new SandboxSnapshotError(
            `sandbox files exceed the ${formatBytes(MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES)} total limit`
        );
    }
}
