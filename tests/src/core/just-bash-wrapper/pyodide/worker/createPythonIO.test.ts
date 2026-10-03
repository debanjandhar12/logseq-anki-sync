import {describe, expect, test} from "vitest";
import {createPythonIO} from "../../../../../../src/core/just-bash-wrapper/pyodide/worker/createPythonIO";

describe("Python I/O", () => {
    test("decodes split UTF-8 writes independently and finishes once", () => {
        const io = createPythonIO("café\n😀");
        const bytes = new TextEncoder().encode("😀");
        io.stdout.write(bytes.subarray(0, 2));
        io.stderr.write(new TextEncoder().encode("error"));
        io.stdout.write(bytes.subarray(2));
        io.finish();
        io.finish();
        expect(io.result(0)).toEqual({stdout: "😀", stderr: "error", exitCode: 0});
        expect(io.stdin.stdin()).toBe("café\n");
        expect(io.stdin.stdin()).toBe("😀");
        expect(io.stdin.stdin()).toBeNull();
    });

    test("accepts exactly the cap and recovers safely from output overflow", () => {
        const io = createPythonIO("");
        io.stdout.write(new Uint8Array(1024 * 1024).fill(97));
        expect(() => io.stdout.write(new Uint8Array([98]))).toThrow("output exceeded");
        expect(() => io.stdout.write(new Uint8Array())).toThrow("output exceeded");
        io.finish();
        expect(io.result(1, new Error("output exceeded 1 MiB"))).toEqual({
            stdout: "a".repeat(1024 * 1024),
            stderr: "output exceeded 1 MiB\n",
            exitCode: 1
        });
    });

    test("bounds stderr diagnostics and replacement-character expansion", () => {
        const io = createPythonIO("");
        io.stderr.write(new Uint8Array(1024 * 1024).fill(255));
        const result = io.result(1, new Error(`a${"😀".repeat(5000)}`));
        expect(new TextEncoder().encode(result.stderr).byteLength).toBeLessThanOrEqual(
            1024 * 1024 + 4096
        );
        expect(() => io.finish()).not.toThrow();
    });

    test("flushes pending decoder bytes after a rejected write and deduplicates errors", () => {
        const io = createPythonIO("");
        io.stdout.write(new Uint8Array([240, 159]));
        expect(() => io.stdout.write(new Uint8Array(1024 * 1024))).toThrow();
        io.stderr.write(new TextEncoder().encode("failure\n"));
        expect(io.result(1, new Error("failure"))).toEqual({
            stdout: "�",
            stderr: "failure\n",
            exitCode: 1
        });
    });
});
