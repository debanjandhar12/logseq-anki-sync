import type {ExportedMessageRepository} from "@assistant-ui/react";

export function normalizeRepository(repository: ExportedMessageRepository | undefined) {
    return JSON.parse(JSON.stringify(repository));
}
