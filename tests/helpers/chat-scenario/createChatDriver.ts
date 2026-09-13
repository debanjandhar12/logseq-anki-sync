import {expect} from "vitest";
import {type Locator, page} from "vitest/browser";
import {AddAttachmentCommand} from "../../../src/core/chat-interop/commands/AddAttachmentCommand";
import "../query/getBySlot";

export function createChatDriver(container: HTMLElement | ShadowRoot) {
    const root = page.elementLocator(container instanceof ShadowRoot ? container.host : container);
    const userMessage = (index: number) => root.getBySlot("aui_user-message-root").nth(index);
    const assistantMessage = (index: number) =>
        root.getBySlot("aui_assistant-message-root").nth(index);
    const messageInput = root.getByRole("textbox", {name: "Message input", exact: true});
    return {
        root,
        messageInput,
        userMessage,
        assistantMessage,
        async sendMessage(text: string) {
            await messageInput.fill(text);
            await root.getByRole("button", {name: "Send message", exact: true}).click();
            await expect.element(messageInput).toHaveValue("");
        },
        async openThreadHistory() {
            await root.getByRole("button", {name: "Thread history", exact: true}).click();
            await expect
                .element(root.getByRole("button", {name: "Back to thread", exact: true}))
                .toBeVisible();
        },
        async openThread(title: string, expectedText: string) {
            await root.getByRole("button", {name: "Thread history", exact: true}).click();
            await root.getByRole("button", {name: title, exact: true}).click();
            await expect.element(root.getByText(expectedText, {exact: true})).toBeVisible();
            await expect.element(messageInput).toBeVisible();
        },
        async beginEdit(index: number) {
            await userMessage(index).hover();
            await userMessage(index).getByRole("button", {name: "Edit", exact: true}).click();
            const editor = root.getBySlot("aui_edit-composer-wrapper");
            await expect.element(editor.getByRole("textbox")).toBeVisible();
            return editor;
        },
        async clickRefresh(index: number) {
            await assistantMessage(index)
                .getByRole("button", {name: "Refresh", exact: true})
                .click();
        },
        async expandReasoning(message: Locator) {
            const trigger = message.getByRole("button", {name: /^Reasoning(?:\s|$)/});
            if (trigger.element().getAttribute("aria-expanded") !== "true") await trigger.click();
        },
        async addAttachment(uuid: string, label: string, expectedName: string) {
            await new AddAttachmentCommand(uuid).execute();
            await expect
                .element(
                    root
                        .getBySlot("aui_composer-shell")
                        .getByRole("button", {name: label, exact: true})
                        .filter({hasText: expectedName})
                )
                .toBeVisible();
        },
        async confirmModal(choice: "revert-and-switch" | "cancel") {
            const dialog = page.getByRole("dialog", {
                name: "The current branch has applied uncommitted changes. Do you want to revert them and switch branches?",
                exact: true
            });
            await expect.element(dialog).toBeVisible();
            const name = choice === "cancel" ? "Cancel" : /^Revert & Switch(?:\s*⏎)?$/;
            await dialog.getByRole("button", {name, exact: true}).click();
            await expect.element(dialog).not.toBeInTheDocument();
        },
        async reviewAndCommit(action: "commit" | "discard" | "defer" | "close" = "commit") {
            await root.getByRole("button", {name: "Review & Commit", exact: true}).click();
            const review = page.getByRole("dialog", {
                name: "Review uncommitted changes",
                exact: true
            });
            await expect.element(review).toBeVisible();
            if (action === "close") {
                await review.getByRole("button", {name: "Close", exact: true}).click();
            } else {
                await review.getByRole("combobox", {name: "Review action", exact: true}).click();
                const labels = {
                    commit: "Approve and Commit",
                    discard: "Reject and Revert Changes",
                    defer: "Defer Commit"
                };
                await review.getByRole("option", {name: labels[action], exact: true}).click();
                await review.getByRole("button", {name: "Confirm", exact: true}).click();
            }
            await expect.element(review).not.toBeInTheDocument();
        }
    };
}
export type ChatDriver = ReturnType<typeof createChatDriver>;
