import type {ExportedMessageRepository} from "@assistant-ui/react";
import {expect} from "vitest";
import {type TrackerLocation, trackerAt} from "./trackerAt";

export function expectTracker(
    repository: ExportedMessageRepository,
    retained: number,
    applied: number,
    location?: TrackerLocation
) {
    const result = trackerAt(repository, location);
    expect(result.tracker.getCommands()).toHaveLength(retained);
    expect(result.tracker.getAppliedCommandCount()).toBe(applied);
    return result;
}
