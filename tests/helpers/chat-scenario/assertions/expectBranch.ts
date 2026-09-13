import type {ExportedMessageRepository} from "@assistant-ui/react";
import {expect} from "vitest";
import type {Locator} from "vitest/browser";
import type {ChatDriver} from "../createChatDriver";

export interface RepositoryNode {
    message: ExportedMessageRepository["messages"][number]["message"];
    parentId: string | null;
}

/**
 * Find a message node by its text content.
 * Asserts that exactly one message matches.
 */
export function nodeWithText(repository: ExportedMessageRepository, text: string): RepositoryNode {
    const nodes = repository.messages.filter(({message}) =>
        message.content.some((part) => part.type === "text" && part.text === text)
    );
    expect(nodes).toHaveLength(1);
    return nodes[0];
}

/**
 * Verify that edit/refresh buttons have the expected enabled state for a message.
 */
export async function expectEditable(
    driver: ChatDriver,
    index: number,
    enabled: boolean
): Promise<void> {
    // Hover the painted message text rather than the grid's empty allocation.
    await driver.userMessage(index).getByRole("paragraph").first().hover();

    const edit = driver.userMessage(index).getByRole("button", {name: "Edit", exact: true});
    const refresh = driver
        .assistantMessage(index)
        .getByRole("button", {name: "Refresh", exact: true});

    if (enabled) {
        await expect.element(edit).toBeEnabled();
        await expect.element(refresh).toBeEnabled();
    } else {
        // Autohide may remove a disabled action from the accessibility tree after scrolling.
        await expect
            .poll(() => {
                const button = driver
                    .userMessage(index)
                    .element()
                    .querySelector<HTMLButtonElement>("button.aui-user-action-edit");
                return button?.disabled;
            })
            .toBe(true);
        await expect.element(refresh).toBeDisabled();
    }
}

/**
 * Verify the branch counter displays the expected value (1 or 2).
 */
export async function expectBranchCounter(message: Locator, number: 1 | 2): Promise<void> {
    await expect.element(message.getByText(new RegExp(`^${number}\\s*/\\s*2$`))).toBeVisible();
}

/**
 * Verify the branch endpoint state: counter value and Previous/Next button states.
 */
export async function expectBranchEndpoint(message: Locator, number: 1 | 2): Promise<void> {
    await expectBranchCounter(message, number);
    const previous = message.getByRole("button", {name: "Previous", exact: true});
    const next = message.getByRole("button", {name: "Next", exact: true});
    await expect.element(previous).toBeVisible();
    await expect.element(next).toBeVisible();
    if (number === 1) {
        await expect.element(previous).toBeDisabled();
        await expect.element(next).toBeEnabled();
    } else {
        await expect.element(previous).toBeEnabled();
        await expect.element(next).toBeDisabled();
    }
}
