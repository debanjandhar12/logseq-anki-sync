import type {PythonExecutionResult} from "../types";

const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_DIAGNOSTIC_BYTES = 4096;

export function createPythonIO(stdin: string) {
    const stdout = createOutputStream();
    const stderr = createOutputStream();
    let stdinOffset = 0;
    return {
        stdout: {write: stdout.write},
        stderr: {write: stderr.write},
        stdin: {
            stdin: () => {
                if (stdinOffset >= stdin.length) return null;
                const newline = stdin.indexOf("\n", stdinOffset);
                const end = newline === -1 ? stdin.length : newline + 1;
                const line = stdin.slice(stdinOffset, end);
                stdinOffset = end;
                return line;
            },
            autoEOF: true
        },
        finish() {
            stdout.finish();
            stderr.finish();
        },
        result(exitCode: number, error?: unknown): PythonExecutionResult {
            stdout.finish();
            stderr.finish();
            let errorOutput = stderr.text();
            if (error !== undefined) {
                const message = error instanceof Error ? error.message : String(error);
                if (!errorOutput.includes(message)) {
                    const bytes = new TextEncoder().encode(
                        message.endsWith("\n") ? message : `${message}\n`
                    );
                    errorOutput += new TextDecoder().decode(
                        bytes.subarray(0, MAX_DIAGNOSTIC_BYTES),
                        {stream: true}
                    );
                }
            }
            return {stdout: stdout.text(), stderr: errorOutput, exitCode};
        }
    };
}

function createOutputStream() {
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let byteCount = 0;
    let decodedByteCount = 0;
    let overflow = false;
    let finished = false;
    const encoder = new TextEncoder();
    const append = (value: string) => {
        const bytes = encoder.encode(value);
        const remaining = MAX_OUTPUT_BYTES - decodedByteCount;
        // Valid UTF-8 normally fits exactly; replacement characters may expand invalid input.
        if (bytes.byteLength > remaining) {
            // Ignore a trailing partial character rather than exceed the byte cap.
            chunks.push(new TextDecoder().decode(bytes.subarray(0, remaining), {stream: true}));
            decodedByteCount = MAX_OUTPUT_BYTES;
        } else {
            chunks.push(value);
            decodedByteCount += bytes.byteLength;
        }
    };
    return {
        write(buffer: Uint8Array): number {
            if (overflow || byteCount + buffer.byteLength > MAX_OUTPUT_BYTES) {
                overflow = true;
                throw new Error("output exceeded 1 MiB");
            }
            byteCount += buffer.byteLength;
            append(decoder.decode(buffer, {stream: true}));
            return buffer.byteLength;
        },
        finish() {
            if (finished) return;
            finished = true;
            append(decoder.decode());
        },
        text: () => chunks.join("")
    };
}
