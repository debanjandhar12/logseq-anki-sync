import {afterAll, beforeAll, describe, expect} from "vitest";
import {findLastLogseqReversibleTransactionTracker} from "../../../src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {isPageSoftDeleted} from "../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";
import {ThreadStore} from "../../../src/core/stores/thread-store/ThreadStore";
import {findToolPart} from "../../helpers/chat-scenario/assertions/findToolPart";
import {waitForSavedConversation} from "../../helpers/chat-scenario/assertions/waitForSavedConversation";
import {SCENARIO_TITLE, test} from "../../helpers/chat-scenario/fixtures";
import {deletePagePermanently} from "../../helpers/logseq/deletePagePermanently";
import {textSegment} from "../../helpers/mock-language-model/builders/textSegment";
import {toolCallsSegment} from "../../helpers/mock-language-model/builders/toolCallsSegment";

describe("Basic conversation", () => {
    const cleanup = () => deletePagePermanently("test-ai-chat-conversation-created");
    beforeAll(cleanup, 60_000);
    afterAll(cleanup, 60_000);
    test("sending a message displays an assistant reply", async ({chat, model}) => {
        const languageModel = model.respondWith([
            {segments: [textSegment("Hello from the assistant.")]}
        ]);
        const driver = await chat.mount();
        await driver.sendMessage("Hello from the user.");
        await expect
            .element(
                driver.assistantMessage(0).getByText("Hello from the assistant.", {exact: true})
            )
            .toBeVisible();
        expect(languageModel.doStreamCalls).toHaveLength(1);
        expect(languageModel.doStreamCalls[0].prompt).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    role: "user",
                    content: expect.arrayContaining([{type: "text", text: "Hello from the user."}])
                })
            ])
        );
        await expect
            .poll(async () => (await ThreadStore.listThreads())[0]?.title)
            .toBe(SCENARIO_TITLE);
        const thread = (await ThreadStore.listThreads())[0];
        const repository = await waitForSavedConversation(
            thread.remoteId,
            "Hello from the assistant."
        );
        expect(repository.messages).toHaveLength(2);
        const [user, assistant] = repository.messages;
        expect(user.parentId).toBeNull();
        expect(assistant.parentId).toBe(user.message.id);
        expect(repository.headId).toBe(assistant.message.id);
    });

    test("the assistant automatically follows up after successfully creating a Logseq page", async ({
        chat,
        model
    }) => {
        const pageName = "test-ai-chat-conversation-created";
        const languageModel = model.respondWith([
            {
                segments: [
                    toolCallsSegment([
                        {toolCallId: "create-p", toolName: "logseq_create_page", input: {pageName}}
                    ])
                ]
            },
            {segments: [textSegment("The page was created successfully.")]}
        ]);
        const driver = await chat.mount();
        await driver.sendMessage(`Create a page named ${pageName}`);
        await expect
            .element(
                driver
                    .assistantMessage(0)
                    .getByText("The page was created successfully.", {exact: true})
            )
            .toBeVisible();
        expect(languageModel.doStreamCalls).toHaveLength(2);
        const thread = (await ThreadStore.listThreads())[0];
        const repository = await waitForSavedConversation(
            thread.remoteId,
            "The page was created successfully."
        );
        expect(repository.messages).toHaveLength(2);
        const part = findToolPart(repository, "create-p");
        expect(part.result).toMatchObject({success: true});
        expect(part.artifact).toBeDefined();
        const tracker = findLastLogseqReversibleTransactionTracker(
            repository.messages.map(({message}) => message)
        )!.tracker;
        expect(tracker.getCommands()).toHaveLength(1);
        expect(tracker.getAppliedCommandCount()).toBe(1);
        const created = await logseq.Editor.getPage(pageName);
        expect(created).not.toBeNull();
        expect(isPageSoftDeleted(created!)).toBe(false);
        expect(JSON.stringify(part.result)).toContain(created!.uuid);
        expect(languageModel.doStreamCalls[1].prompt).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    role: "tool",
                    content: expect.arrayContaining([
                        expect.objectContaining({
                            type: "tool-result",
                            toolCallId: "create-p",
                            output: {type: "json", value: part.result}
                        })
                    ])
                })
            ])
        );
        await driver.expandReasoning(driver.assistantMessage(0));
        await expect
            .element(driver.assistantMessage(0).getBySlot("tool-fallback-trigger-icon"))
            .toHaveAttribute("aria-label", "Tool complete");
    });

    test("the assistant automatically follows up when creating an existing Logseq page fails", async ({
        chat,
        model
    }) => {
        // "Page" always exists in a DB graph as a built-in tag page, so creating it fails.
        const existing = await logseq.Editor.getPage("Page");
        expect(existing, "The built-in Page tag must exist").not.toBeNull();
        const languageModel = model.respondWith([
            {
                segments: [
                    toolCallsSegment([
                        {
                            toolCallId: "create-existing",
                            toolName: "logseq_create_page",
                            input: {pageName: "Page"}
                        }
                    ])
                ]
            },
            {segments: [textSegment("That page already exists.")]}
        ]);
        const driver = await chat.mount();
        await driver.sendMessage("Create a page named Page");
        await expect
            .element(
                driver.assistantMessage(0).getByText("That page already exists.", {exact: true})
            )
            .toBeVisible();
        expect(languageModel.doStreamCalls).toHaveLength(2);
        const thread = (await ThreadStore.listThreads())[0];
        const repository = await waitForSavedConversation(
            thread.remoteId,
            "That page already exists."
        );
        const part = findToolPart(repository, "create-existing");
        expect(part.isError).toBe(true);
        const tracker = findLastLogseqReversibleTransactionTracker(
            repository.messages.map(({message}) => message)
        );
        expect(tracker?.tracker.getCommands().length ?? 0).toBe(0);
        expect(part.result).toMatchObject({
            success: false,
            error: expect.stringContaining("Page already exists: Page")
        });
        expect(languageModel.doStreamCalls[1].prompt).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    role: "tool",
                    content: expect.arrayContaining([
                        expect.objectContaining({
                            toolCallId: "create-existing",
                            output: {type: "error-text", value: JSON.stringify(part.result)}
                        })
                    ])
                })
            ])
        );
        expect((await logseq.Editor.getPage("Page"))?.uuid).toBe(existing!.uuid);
        expect(isPageSoftDeleted((await logseq.Editor.getPage("Page"))!)).toBe(false);
        await driver.expandReasoning(driver.assistantMessage(0));
        await expect
            .element(driver.assistantMessage(0).getBySlot("tool-fallback-trigger-icon"))
            .toHaveAttribute("aria-label", "Tool failed");
    });
});
