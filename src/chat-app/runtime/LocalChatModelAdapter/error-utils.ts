export function getErrorMessage(error: unknown): string {
    if (isRecord(error)) {
        const cause = error.cause;
        const causeMessage =
            cause !== error && cause !== undefined ? getErrorMessage(cause) : undefined;
        const message = typeof error.message === "string" ? error.message : undefined;

        if (message === "No output generated. Check the stream for errors." && causeMessage) {
            return causeMessage;
        }
        if (message) return causeMessage ? `${message}: ${causeMessage}` : message;
    }
    if (error instanceof Error) return error.message;
    return typeof error === "string" ? error : "An unexpected error occurred.";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
