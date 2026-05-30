export function getErrorMessageFromErrObj(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    if (error === null || error === undefined) return "Unknown error";

    if (typeof error === "object") {
        const errorRecord = error as Record<string, unknown>;
        const message = errorRecord.message ?? errorRecord.error ?? errorRecord.reason;
        if (typeof message === "string" && message.trim().length > 0) {
            return message;
        }

        try {
            return JSON.stringify(error);
        } catch {
            return String(error);
        }
    }

    return String(error);
}
