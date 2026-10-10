// @vitest-environment node
import {describe, expect, test} from "vitest";
import {
    MAX_SANDBOX_SNAPSHOT_FILE_BYTES,
    MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES
} from "../../../../../../src/core/just-bash-wrapper/pyodide/just-bash-fs-bridge/constants";
import {assertFileWithinSnapshotBudget} from "../../../../../../src/core/just-bash-wrapper/pyodide/just-bash-fs-bridge/utils/assertFileWithinSnapshotBudget";
import {assertTotalWithinSnapshotBudget} from "../../../../../../src/core/just-bash-wrapper/pyodide/just-bash-fs-bridge/utils/assertTotalWithinSnapshotBudget";
import {formatBytes} from "../../../../../../src/core/just-bash-wrapper/pyodide/just-bash-fs-bridge/utils/formatBytes";
import {SandboxSnapshotError} from "../../../../../../src/core/just-bash-wrapper/pyodide/just-bash-fs-bridge/utils/SandboxSnapshotError";
import {SandboxWriteBackAbortedError} from "../../../../../../src/core/just-bash-wrapper/pyodide/just-bash-fs-bridge/utils/SandboxWriteBackAbortedError";

describe("snapshot budget utilities", () => {
    test("formats both limits and accepts sizes exactly at their boundaries", () => {
        expect(formatBytes(MAX_SANDBOX_SNAPSHOT_FILE_BYTES)).toBe("16 MiB");
        expect(formatBytes(MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES)).toBe("128 MiB");
        expect(() =>
            assertFileWithinSnapshotBudget("/home/user/file", MAX_SANDBOX_SNAPSHOT_FILE_BYTES)
        ).not.toThrow();
        expect(() =>
            assertTotalWithinSnapshotBudget(MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES)
        ).not.toThrow();
    });

    test("rejects oversized files with a quoted path and the original error type", () => {
        const path = '/home/user/a"b.txt';
        const assertBudget = () =>
            assertFileWithinSnapshotBudget(path, MAX_SANDBOX_SNAPSHOT_FILE_BYTES + 1);
        expect(assertBudget).toThrow(SandboxSnapshotError);
        expect(assertBudget).toThrow(`${JSON.stringify(path)} exceeds the 16 MiB per-file limit`);
    });

    test("rejects an oversized aggregate with the original error type and message", () => {
        const assertBudget = () =>
            assertTotalWithinSnapshotBudget(MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES + 1);
        expect(assertBudget).toThrow(SandboxSnapshotError);
        expect(assertBudget).toThrow("sandbox files exceed the 128 MiB total limit");
    });

    test("preserves error names and messages", () => {
        const snapshotError = new SandboxSnapshotError("snapshot failed");
        expect(snapshotError).toBeInstanceOf(Error);
        expect(snapshotError.name).toBe("SandboxSnapshotError");
        expect(snapshotError.message).toBe("snapshot failed");
        const abortedError = new SandboxWriteBackAbortedError();
        expect(abortedError).toBeInstanceOf(Error);
        expect(abortedError.name).toBe("SandboxWriteBackAbortedError");
        expect(abortedError.message).toBe("execution aborted before filesystem write-back");
    });
});
