import type {ExportedMessageRepository} from "@assistant-ui/react";
import {describe, expect} from "vitest";
import type {Locator} from "vitest/browser";
import {ThreadStore} from "../../../src/core/stores/thread-store/ThreadStore";
import {
    normalizeRepository,
    waitForSavedConversation
} from "../../helpers/chat-scenario/assertions";
import {test} from "../../helpers/chat-scenario/fixtures/aiChatScenarioFixture";
import {buildBranchedThread} from "../../helpers/chat-scenario/threadBuilders";
import {textSegment} from "../../helpers/mock-language-model/builders/textSegment";

async function expectBranchEndpoint(message: Locator, number: 1 | 2) {
    await expect.element(message.getByText(new RegExp(`^${number}\\s*/\\s*2$`))).toBeVisible();
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

function nodeWithText(repository: ExportedMessageRepository, text: string) {
    const matches = repository.messages.filter(({message}) =>
        message.content.some((part) => part.type === "text" && part.text === text)
    );
    expect(matches).toHaveLength(1);
    return matches[0];
}

describe("Basic branching", () => {
    test("editing a user message preserves the original branch and generates a fresh response", async ({
        chat,
        model
    }) => {
        const originalQuestion = "Explain the original question.";
        const originalAnswer = "This answer belongs to the original question.";
        const editedQuestion = "Explain the edited question instead.";
        const editedAnswer = "This answer belongs to the edited question.";
        const languageModel = model.respondWith([
            {segments: [textSegment(originalAnswer)]},
            {segments: [textSegment(editedAnswer)]}
        ]);
        const driver = await chat.mount();
        await driver.sendMessage(originalQuestion);
        await expect
            .element(driver.userMessage(0).getByText(originalQuestion, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.assistantMessage(0).getByText(originalAnswer, {exact: true}))
            .toBeVisible();
        await expect.poll(async () => (await ThreadStore.listThreads()).length).toBe(1);
        const [thread] = await ThreadStore.listThreads();
        const originalRepository = await waitForSavedConversation(thread.remoteId, originalAnswer);
        expect(originalRepository.messages).toHaveLength(2);
        const originalUser = nodeWithText(originalRepository, originalQuestion);
        const originalAssistant = nodeWithText(originalRepository, originalAnswer);
        expect(originalUser.message.role).toBe("user");
        expect(originalUser.parentId).toBeNull();
        expect(originalAssistant.parentId).toBe(originalUser.message.id);
        expect(originalRepository.headId).toBe(originalAssistant.message.id);

        const editor = await driver.beginEdit(0);
        await editor.getByRole("textbox").fill(editedQuestion);
        await editor.getByRole("button", {name: "Update", exact: true}).click();
        await expect.element(editor).not.toBeInTheDocument();
        await expect
            .element(driver.userMessage(0).getByText(editedQuestion, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.assistantMessage(0).getByText(editedAnswer, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.root.getByText(originalQuestion, {exact: true}))
            .not.toBeInTheDocument();
        await expect
            .element(driver.root.getByText(originalAnswer, {exact: true}))
            .not.toBeInTheDocument();
        await expectBranchEndpoint(driver.userMessage(0), 2);

        const repository = await waitForSavedConversation(thread.remoteId, editedAnswer);
        expect(repository.messages).toHaveLength(4);
        expect(nodeWithText(repository, originalQuestion)).toEqual(originalUser);
        expect(nodeWithText(repository, originalAnswer)).toEqual(originalAssistant);
        const editedUser = nodeWithText(repository, editedQuestion);
        const editedAssistant = nodeWithText(repository, editedAnswer);
        expect(editedUser.message.role).toBe("user");
        expect(editedUser.message.id).not.toBe(originalUser.message.id);
        expect(editedUser.parentId).toBe(originalUser.parentId);
        expect(editedAssistant.message.role).toBe("assistant");
        expect(editedAssistant.message.id).not.toBe(originalAssistant.message.id);
        expect(editedAssistant.parentId).toBe(editedUser.message.id);
        expect(repository.headId).toBe(editedAssistant.message.id);
        expect(repository.messages.some(({parentId}) => parentId === repository.headId)).toBe(
            false
        );
        expect((await ThreadStore.listThreads()).map(({remoteId}) => remoteId)).toEqual([
            thread.remoteId
        ]);
        expect(languageModel.doStreamCalls).toHaveLength(2);
        expect(languageModel.doStreamCalls[0].prompt.filter(({role}) => role !== "system")).toEqual(
            [{role: "user", content: [{type: "text", text: originalQuestion}]}]
        );
        expect(languageModel.doStreamCalls[1].prompt.filter(({role}) => role !== "system")).toEqual(
            [{role: "user", content: [{type: "text", text: editedQuestion}]}]
        );
        expect(JSON.stringify(languageModel.doStreamCalls[1].prompt)).not.toContain(
            originalQuestion
        );
        expect(JSON.stringify(languageModel.doStreamCalls[1].prompt)).not.toContain(originalAnswer);
        expect(model.runs).toHaveLength(2);
    });

    test("Refresh preserves the original response and creates a sibling assistant branch", async ({
        chat,
        model
    }) => {
        const question = "Give me a response I can refresh.";
        const originalAnswer = "The original response before Refresh.";
        const refreshedAnswer = "The replacement response after Refresh.";
        const languageModel = model.respondWith([
            {segments: [textSegment(originalAnswer)]},
            {segments: [textSegment(refreshedAnswer)]}
        ]);
        const driver = await chat.mount();
        await driver.sendMessage(question);
        await expect
            .element(driver.assistantMessage(0).getByText(originalAnswer, {exact: true}))
            .toBeVisible();
        await expect.poll(async () => (await ThreadStore.listThreads()).length).toBe(1);
        const [thread] = await ThreadStore.listThreads();
        const originalRepository = await waitForSavedConversation(thread.remoteId, originalAnswer);
        expect(originalRepository.messages).toHaveLength(2);
        const user = nodeWithText(originalRepository, question);
        const originalAssistant = nodeWithText(originalRepository, originalAnswer);
        expect(user.parentId).toBeNull();
        expect(originalAssistant.parentId).toBe(user.message.id);
        expect(originalRepository.headId).toBe(originalAssistant.message.id);

        await driver.clickRefresh(0);
        await expect
            .element(driver.userMessage(0).getByText(question, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.assistantMessage(0).getByText(refreshedAnswer, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.root.getByText(originalAnswer, {exact: true}))
            .not.toBeInTheDocument();
        await expectBranchEndpoint(driver.assistantMessage(0), 2);

        const repository = await waitForSavedConversation(thread.remoteId, refreshedAnswer);
        expect(repository.messages).toHaveLength(3);
        expect(nodeWithText(repository, question)).toEqual(user);
        expect(nodeWithText(repository, originalAnswer)).toEqual(originalAssistant);
        const refreshedAssistant = nodeWithText(repository, refreshedAnswer);
        expect(refreshedAssistant.message.role).toBe("assistant");
        expect(refreshedAssistant.message.id).not.toBe(originalAssistant.message.id);
        expect(refreshedAssistant.parentId).toBe(originalAssistant.parentId);
        expect(repository.headId).toBe(refreshedAssistant.message.id);
        expect(repository.messages.some(({parentId}) => parentId === repository.headId)).toBe(
            false
        );
        expect((await ThreadStore.listThreads()).map(({remoteId}) => remoteId)).toEqual([
            thread.remoteId
        ]);
        expect(languageModel.doStreamCalls).toHaveLength(2);
        for (const call of languageModel.doStreamCalls) {
            expect(call.prompt.filter(({role}) => role !== "system")).toEqual([
                {role: "user", content: [{type: "text", text: question}]}
            ]);
        }
        expect(JSON.stringify(languageModel.doStreamCalls[1].prompt)).not.toContain(originalAnswer);
        expect(model.runs).toHaveLength(2);
    });

    test("Previous and Next navigate seeded user branches and remember their assistant descendants", async ({
        chat,
        model,
        storage
    }) => {
        const {thread, ids, texts} = buildBranchedThread({
            id: "user-navigation",
            head: "refreshed"
        });
        await storage.seedThread(thread);
        const savedRepository = normalizeRepository(
            (await ThreadStore.loadThread(thread.remoteId))!.exportedMessageRepository
        );
        const driver = await chat.mount();
        await driver.openThread(thread.title!, texts.a1Refreshed);
        await expect
            .element(driver.userMessage(0).getByText(texts.u0, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.assistantMessage(0).getByText(texts.a0, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.userMessage(1).getByText(texts.u1Original, {exact: true}))
            .toBeVisible();
        await expectBranchEndpoint(driver.userMessage(1), 1);

        await driver.userMessage(1).getByRole("button", {name: "Next", exact: true}).click();
        await expect
            .element(driver.userMessage(1).getByText(texts.u1Edited, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.assistantMessage(1).getByText(texts.a1Edited, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.root.getByText(texts.u1Original, {exact: true}))
            .not.toBeInTheDocument();
        await expect
            .element(driver.root.getByText(texts.a1Refreshed, {exact: true}))
            .not.toBeInTheDocument();
        await expectBranchEndpoint(driver.userMessage(1), 2);
        expect(
            normalizeRepository(
                (await ThreadStore.loadThread(thread.remoteId))!.exportedMessageRepository
            )
        ).toEqual(savedRepository);

        await driver.userMessage(1).getByRole("button", {name: "Previous", exact: true}).click();
        await expect
            .element(driver.userMessage(1).getByText(texts.u1Original, {exact: true}))
            .toBeVisible();
        // The runtime follows the remembered refreshed descendant, not the first assistant sibling.
        await expect
            .element(driver.assistantMessage(1).getByText(texts.a1Refreshed, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.root.getByText(texts.a1Original, {exact: true}))
            .not.toBeInTheDocument();
        await expect
            .element(driver.root.getByText(texts.u1Edited, {exact: true}))
            .not.toBeInTheDocument();
        await expect
            .element(driver.root.getByText(texts.a1Edited, {exact: true}))
            .not.toBeInTheDocument();
        await expectBranchEndpoint(driver.userMessage(1), 1);
        await expect
            .element(driver.userMessage(0).getByText(texts.u0, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.assistantMessage(0).getByText(texts.a0, {exact: true}))
            .toBeVisible();
        await chat.unmount();
        // Selection is runtime-only; navigation neither appends nodes nor changes the stored head.
        const persisted = (await ThreadStore.loadThread(thread.remoteId))!
            .exportedMessageRepository!;
        expect(normalizeRepository(persisted)).toEqual(savedRepository);
        expect(persisted.headId).toBe(ids.a1Refreshed);
        expect((await ThreadStore.listThreads()).map(({remoteId}) => remoteId)).toEqual([
            thread.remoteId
        ]);
        expect(model.runs).toHaveLength(0);
    });

    test("Previous and Next navigate seeded assistant siblings without generating or persisting messages", async ({
        chat,
        model,
        storage
    }) => {
        const {thread, ids, texts} = buildBranchedThread({
            id: "assistant-navigation",
            head: "refreshed"
        });
        await storage.seedThread(thread);
        const savedRepository = normalizeRepository(
            (await ThreadStore.loadThread(thread.remoteId))!.exportedMessageRepository
        );
        const driver = await chat.mount();
        await driver.openThread(thread.title!, texts.a1Refreshed);
        await expect
            .element(driver.userMessage(1).getByText(texts.u1Original, {exact: true}))
            .toBeVisible();
        await expectBranchEndpoint(driver.assistantMessage(1), 2);

        await driver
            .assistantMessage(1)
            .getByRole("button", {name: "Previous", exact: true})
            .click();
        await expect
            .element(driver.assistantMessage(1).getByText(texts.a1Original, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.root.getByText(texts.a1Refreshed, {exact: true}))
            .not.toBeInTheDocument();
        await expect
            .element(driver.userMessage(1).getByText(texts.u1Original, {exact: true}))
            .toBeVisible();
        await expectBranchEndpoint(driver.assistantMessage(1), 1);
        expect(
            normalizeRepository(
                (await ThreadStore.loadThread(thread.remoteId))!.exportedMessageRepository
            )
        ).toEqual(savedRepository);

        await driver.assistantMessage(1).getByRole("button", {name: "Next", exact: true}).click();
        await expect
            .element(driver.assistantMessage(1).getByText(texts.a1Refreshed, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.root.getByText(texts.a1Original, {exact: true}))
            .not.toBeInTheDocument();
        await expect
            .element(driver.root.getByText(texts.u1Edited, {exact: true}))
            .not.toBeInTheDocument();
        await expect
            .element(driver.root.getByText(texts.a1Edited, {exact: true}))
            .not.toBeInTheDocument();
        await expect
            .element(driver.userMessage(1).getByText(texts.u1Original, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.userMessage(0).getByText(texts.u0, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.assistantMessage(0).getByText(texts.a0, {exact: true}))
            .toBeVisible();
        await expectBranchEndpoint(driver.assistantMessage(1), 2);
        await chat.unmount();
        const persisted = (await ThreadStore.loadThread(thread.remoteId))!
            .exportedMessageRepository!;
        expect(normalizeRepository(persisted)).toEqual(savedRepository);
        expect(persisted.headId).toBe(ids.a1Refreshed);
        expect((await ThreadStore.listThreads()).map(({remoteId}) => remoteId)).toEqual([
            thread.remoteId
        ]);
        expect(model.runs).toHaveLength(0);
    });
});
