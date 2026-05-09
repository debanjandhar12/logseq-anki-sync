import type {ExportedMessageRepository} from "@assistant-ui/react";

export interface ThreadFileData {
    remoteId: string;
    title?: string;
    exportedMessageRepository?: ExportedMessageRepository; // actual messages
    status: "regular" | "archived";
    custom: {
        createdAt: Date;
        updatedAt: Date;
        createdByPluginVersion: string;
    };
}
