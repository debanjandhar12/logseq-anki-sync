// @vitest-environment node
import {describe, expect, test} from "vitest";
import {
    MAX_SANDBOX_SNAPSHOT_FILE_BYTES,
    MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES
} from "../../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/constants";
import {SandboxBudget} from "../../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/SandboxBudget";
import {SandboxSnapshotError} from "../../../../../../src/core/just-bash-wrapper/pyodide/sandbox-tree/SandboxSnapshotError";

describe("SandboxBudget", () => {
    test("pre-checks without counting bytes twice and accepts exact boundaries", () => {
        const budget = new SandboxBudget();
        for (
            let bytes = 0;
            bytes < MAX_SANDBOX_SNAPSHOT_TOTAL_BYTES;
            bytes += MAX_SANDBOX_SNAPSHOT_FILE_BYTES
        ) {
            budget.assertCanAdd("/file", MAX_SANDBOX_SNAPSHOT_FILE_BYTES);
            budget.add("/file", MAX_SANDBOX_SNAPSHOT_FILE_BYTES);
        }
        expect(() => budget.add("/empty", 0)).not.toThrow();
        expect(() => budget.add("/extra", 1)).toThrow(
            "sandbox files exceed the 128 MiB total limit"
        );
    });

    test("rejects oversized files with the original error type and quoted path", () => {
        const budget = new SandboxBudget();
        const path = '/home/user/a"b.txt';
        const check = () => budget.add(path, MAX_SANDBOX_SNAPSHOT_FILE_BYTES + 1);
        expect(check).toThrow(SandboxSnapshotError);
        expect(check).toThrow(`${JSON.stringify(path)} exceeds the 16 MiB per-file limit`);
        // A rejected addition must not consume the budget.
        expect(() => budget.add(path, MAX_SANDBOX_SNAPSHOT_FILE_BYTES)).not.toThrow();
        expect(new SandboxSnapshotError("failed").name).toBe("SandboxSnapshotError");
    });
});
