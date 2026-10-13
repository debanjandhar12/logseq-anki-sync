import {expect} from "vitest";
import {type Locator, locators, page} from "vitest/browser";
import {AddAttachmentCommand} from "../../../src/core/chat-interop/commands/AddAttachmentCommand";

declare module "vitest/browser" {
    interface LocatorSelectors {
        getBySlot(slot: string): Locator;
    }
}
locators.extend({
    getBySlot(slot: string) {
        return `css=[data-slot="${slot}"]`;
    }
});

export function createChatDriver(container: HTMLElement | ShadowRoot) {
    const root = page.elementLocator(container as HTMLElement);
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
            const trigger = message.getBySlot("reasoning-trigger");
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
            // Secondary modals are siblings of the chat, so use page-level semantic locators.
            const name = choice === "cancel" ? "Cancel" : /^Revert & Switch(?:\s*⏎)?$/;
            await page.getByRole("button", {name, exact: true}).click();
            await expect
                .element(
                    page.getByText(
                        "The current branch has applied uncommitted changes. Do you want to revert them and switch branches?",
                        {exact: true}
                    )
                )
                .not.toBeInTheDocument();
        }
    };
}
export type ChatDriver = ReturnType<typeof createChatDriver>;
