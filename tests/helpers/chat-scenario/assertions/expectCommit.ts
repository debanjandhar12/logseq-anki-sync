import type {ExportedMessageRepository} from "@assistant-ui/react";
import {expect} from "vitest";
import {findToolPart} from "./findToolPart";
import {trackerAt} from "./trackerAt";

/**
 * Verify the commit tool result matches the expected outcome.
 */
export function expectCommitResult(
    repository: ExportedMessageRepository,
    outcome: "committed" | "no-changes"
): void {
    expect(findToolPart(repository, "commit").result).toMatchObject({success: true, outcome});
}

/**
 * Verify there are no pending transaction trackers.
 */
export function expectNoPendingTracker(repository: ExportedMessageRepository): void {
    const {tracker} = trackerAt(repository);
    expect(tracker.getCommands()).toHaveLength(0);
    expect(tracker.getAppliedCommandCount()).toBe(0);
}
