import type {ExportedMessageRepository} from "@assistant-ui/react";
import {expect} from "vitest";
import {normalizeRepository} from "./normalizeRepository";

/**
 * Verify a linear conversation has the expected number of turns.
 */
export function expectLinearConversation(
    repository: ExportedMessageRepository,
    expectedTurns: number
): void {
    // Each turn = 2 messages (user + assistant)
    const expectedMessages = expectedTurns * 2;
    expect(repository.messages).toHaveLength(expectedMessages);

    // Verify structure: user messages should alternate with assistant messages
    for (let i = 0; i < repository.messages.length; i++) {
        const {message, parentId} = repository.messages[i];
        const expectedRole = i % 2 === 0 ? "user" : "assistant";

        expect(message.role).toBe(expectedRole);

        // First message has no parent
        if (i === 0) {
            expect(parentId).toBeNull();
        } else {
            // Each message should have the previous message as parent
            expect(parentId).toBe(repository.messages[i - 1].message.id);
        }
    }

    // Head should point to the last message
    expect(repository.headId).toBe(repository.messages[repository.messages.length - 1].message.id);
}

/**
 * Verify the message tree structure matches expected values.
 */
export function expectMessageTreeStructure(
    repository: ExportedMessageRepository,
    expected: {
        totalMessages: number;
        headId: string;
    }
): void {
    expect(repository.messages).toHaveLength(expected.totalMessages);
    expect(repository.headId).toBe(expected.headId);
}

/**
 * Deep normalize a repository for comparison, excluding transient fields.
 */
export function normalizeRepositoryDeep(
    repository: ExportedMessageRepository | undefined
): unknown {
    return normalizeRepository(repository);
}
