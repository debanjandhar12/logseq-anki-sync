import type {ExportedMessageRepository} from "@assistant-ui/react";
import {expect} from "vitest";
import type {TrackerLocation} from "./trackerAt";

/** Rollback may update the captured tracker artifact, but not the conversation it belongs to. */
export function expectOriginalNodesRetained(
    saved: ExportedMessageRepository,
    original: ExportedMessageRepository,
    location: TrackerLocation
) {
    const withoutRollbackArtifact = (node: (typeof original.messages)[number]) => {
        const copy = structuredClone(node);
        if (copy.message.id === location.messageId) {
            for (const part of copy.message.content) {
                if (part.type === "tool-call" && part.toolCallId === location.toolCallId)
                    Object.assign(part, {artifact: undefined});
            }
        }
        return copy;
    };
    for (const node of original.messages) {
        const retained = saved.messages.find(({message}) => message.id === node.message.id);
        expect(retained).toBeDefined();
        expect(withoutRollbackArtifact(retained!)).toEqual(withoutRollbackArtifact(node));
    }
}
