export class ChatDebugReportFormatter {
    static format(rawThreadJson: string): string {
        const threadData = JSON.parse(rawThreadJson) as unknown;
        const chatDataWithoutArtifacts = JSON.stringify(
            ChatDebugReportFormatter.removeToolCallArtifacts(threadData)
        );

        return [
            "Chat Data without logseq reversible artifacts:",
            "```",
            chatDataWithoutArtifacts,
            "```",
            "",
            "Full Chat Data JSON:",
            "```",
            rawThreadJson,
            "```"
        ].join("\n");
    }

    private static removeToolCallArtifacts(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map((item) => ChatDebugReportFormatter.removeToolCallArtifacts(item));
        }
        if (!value || typeof value !== "object") return value;

        const record = value as Record<string, unknown>;
        return Object.fromEntries(
            Object.entries(record)
                .filter(([key]) => !(record.type === "tool-call" && key === "artifact"))
                .map(([key, item]) => [key, ChatDebugReportFormatter.removeToolCallArtifacts(item)])
        );
    }
}
