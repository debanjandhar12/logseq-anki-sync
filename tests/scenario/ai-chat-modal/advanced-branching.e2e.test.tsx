import type {ExportedMessageRepository} from "@assistant-ui/react";
import {afterAll, beforeEach, describe, expect} from "vitest";
import {page} from "vitest/browser";
import {isPageSoftDeleted} from "../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";
import {ThreadStore} from "../../../src/core/stores/thread-store/ThreadStore";
import {
    expectBranchCounter,
    expectEditable,
    expectOriginalNodesRetained,
    expectTracker,
    nodeWithText,
    trackerAt
} from "../../helpers/chat-scenario/assertions";
import {expectCommitResult} from "../../helpers/chat-scenario/assertions/expectCommit";
import {expectToolResultInPrompt} from "../../helpers/chat-scenario/assertions/expectToolResultInPrompt";
import {findToolPart} from "../../helpers/chat-scenario/assertions/findToolPart";
import {normalizeRepository} from "../../helpers/chat-scenario/assertions/normalizeRepository";
import {waitForSavedConversation} from "../../helpers/chat-scenario/assertions/waitForSavedConversation";
import type {ChatDriver} from "../../helpers/chat-scenario/createChatDriver";
import type {ModelFixture, StorageFixture} from "../../helpers/chat-scenario/fixtures";
import {test} from "../../helpers/chat-scenario/fixtures";
import {buildBranchedThread} from "../../helpers/chat-scenario/threadBuilders";
import {deletePagePermanently} from "../../helpers/logseq/deletePagePermanently";
import {textSegment} from "../../helpers/mock-language-model/builders/textSegment";
import {toolCallsSegment} from "../../helpers/mock-language-model/builders/toolCallsSegment";
import type {ModelStep} from "../../helpers/mock-language-model/types";

const GUARD =
    "The current branch has applied uncommitted changes. Do you want to revert them and switch branches?";
const P = "test-ai-chat-advanced-p";
const Q = "test-ai-chat-advanced-q";
const P_REQUEST = `Create the first page ${P}.`;
const Q_REQUEST = `Create the second page ${Q}.`;
const P_ANSWER = "First page created, P-turn answer sentinel.";
const Q_ANSWER = "Second page created, Q-turn suffix sentinel.";
const FINAL = "Commit outcome follow-up sentinel.";

interface ScenarioContext {
    chat: {mount(): Promise<ChatDriver>};
    model: ModelFixture;
    storage: StorageFixture;
}

const textStep = (text: string): ModelStep => ({segments: [textSegment(text)]});
const createStep = (pageName: string, toolCallId: string): ModelStep => ({
    segments: [toolCallsSegment([{toolCallId, toolName: "logseq_create_page", input: {pageName}}])]
});
const commitStep = (): ModelStep => ({
    segments: [
        toolCallsSegment([{toolCallId: "commit", toolName: "logseq_commit_changes", input: {}}])
    ]
});

async function expectPages(pages: readonly {name: string; uuid: string}[], active: boolean) {
    for (const {name, uuid} of pages) {
        await expect
            .poll(async () => {
                const entity = await logseq.Editor.getPage(uuid);
                return active
                    ? entity?.uuid === uuid && !isPageSoftDeleted(entity)
                    : !entity || isPageSoftDeleted(entity);
            })
            .toBe(true);
        if (active) expect((await logseq.Editor.getPage(name))?.uuid).toBe(uuid);
    }
}

async function loadRepository(id: string) {
    return (await ThreadStore.loadThread(id))!.exportedMessageRepository!;
}

async function capturePage(repository: ExportedMessageRepository, name: string, callId: string) {
    const part = findToolPart(repository, callId);
    expect(part.result).toMatchObject({success: true});
    expect(part.isError).not.toBe(true);
    const entity = await logseq.Editor.getPage(name);
    expect(entity).not.toBeNull();
    expect(JSON.stringify(part.result)).toContain(entity!.uuid);
    return {name, uuid: entity!.uuid};
}

async function setupAppliedBranch(
    context: ScenarioContext,
    head: "original" | "refreshed" | "edited" = "refreshed",
    extraSteps: ModelStep[] = []
) {
    const {chat, model, storage} = context;
    const preset = buildBranchedThread({
        id: "advanced-branch",
        title: "Advanced branch fixture",
        head
    });
    await storage.seedThread(preset.thread);
    const languageModel = model.respondWith([
        createStep(P, "create-p"),
        textStep(P_ANSWER),
        createStep(Q, "create-q"),
        textStep(Q_ANSWER),
        ...extraSteps
    ]);
    const driver = await chat.mount();
    const opening =
        head === "edited"
            ? preset.texts.a1Edited
            : head === "original"
              ? preset.texts.a1Original
              : preset.texts.a1Refreshed;
    await driver.openThread(preset.thread.title!, opening);
    await driver.sendMessage(P_REQUEST);
    await expect
        .element(driver.assistantMessage(2).getByText(P_ANSWER, {exact: true}))
        .toBeVisible();
    await waitForSavedConversation(preset.thread.remoteId, P_ANSWER);
    await driver.sendMessage(Q_REQUEST);
    await expect
        .element(driver.assistantMessage(3).getByText(Q_ANSWER, {exact: true}))
        .toBeVisible();
    const repository = await waitForSavedConversation(preset.thread.remoteId, Q_ANSWER);
    expect(repository.messages).toHaveLength(11);
    const pUser = nodeWithText(repository, P_REQUEST);
    const pAssistant = nodeWithText(repository, P_ANSWER);
    const qUser = nodeWithText(repository, Q_REQUEST);
    const qAssistant = nodeWithText(repository, Q_ANSWER);
    expect(pUser.parentId).toBe(preset.thread.exportedMessageRepository!.headId);
    expect(pAssistant.parentId).toBe(pUser.message.id);
    expect(qUser.parentId).toBe(pAssistant.message.id);
    expect(qAssistant.parentId).toBe(qUser.message.id);
    expect(repository.headId).toBe(qAssistant.message.id);
    const result = trackerAt(repository);
    const location = result.location;
    expect(location.messageId).toBe(qAssistant.message.id);
    expect(location.toolCallId).toBe("create-q");
    expectTracker(repository, 2, 2, location);
    const pages = [
        await capturePage(repository, P, "create-p"),
        await capturePage(repository, Q, "create-q")
    ];
    expect(pages[0].uuid).not.toBe(pages[1].uuid);
    await expectPages(pages, true);
    expectToolResultInPrompt(
        languageModel.doStreamCalls[1].prompt,
        "create-p",
        findToolPart(repository, "create-p").result
    );
    expectToolResultInPrompt(
        languageModel.doStreamCalls[3].prompt,
        "create-q",
        findToolPart(repository, "create-q").result
    );
    expect(languageModel.doStreamCalls).toHaveLength(4);
    return {
        driver,
        languageModel,
        repository,
        snapshot: normalizeRepository(repository),
        location,
        pages,
        preset,
        id: preset.thread.remoteId
    };
}

async function setupPendingCommit({chat, model}: ScenarioContext, followUp = true) {
    const languageModel = model.respondWith([
        createStep(P, "create-p"),
        commitStep(),
        ...(followUp ? [textStep(FINAL)] : [])
    ]);
    const driver = await chat.mount();
    await driver.sendMessage(`Create ${P} and ask me to commit it.`);
    await expect
        .element(driver.root.getByRole("button", {name: "Review & Commit", exact: true}))
        .toBeVisible();
    await expect.poll(async () => (await ThreadStore.listThreads()).length).toBe(1);
    const id = (await ThreadStore.listThreads())[0].remoteId;
    await expect
        .poll(async () => (await loadRepository(id)).messages.at(-1)?.message.status.type)
        .toBe("requires-action");
    const repository = await loadRepository(id);
    const pages = [await capturePage(repository, P, "create-p")];
    expectTracker(repository, 1, 1);
    await expectPages(pages, true);
    expect(languageModel.doStreamCalls).toHaveLength(2);
    expectToolResultInPrompt(
        languageModel.doStreamCalls[1].prompt,
        "create-p",
        findToolPart(repository, "create-p").result
    );
    expect(findToolPart(repository, "commit").result).toBeUndefined();
    return {driver, languageModel, repository, pages, id};
}

async function expectCommit(
    repository: ExportedMessageRepository,
    outcome: "committed" | "no-changes"
) {
    expectCommitResult(repository, outcome);
    expectTracker(repository, 0, 0);
}

const navigationCases = [
    {
        role: "user",
        direction: "Previous",
        titles: {
            confirm: "clicking previous icon on a user message navigates to the old branch",
            cancel: "canceling the confirmation after clicking Previous on a user message keeps the current branch and Logseq changes"
        },
        head: "edited",
        source: "u1Edited",
        destination: "u1Original",
        // This sibling has not been visited; its first assistant is selected.
        answer: "a1Original",
        sourceNumber: 2,
        destinationNumber: 1
    },
    {
        role: "user",
        direction: "Next",
        titles: {
            confirm: "clicking next icon on a user message navigates to the newer branch",
            cancel: "canceling the confirmation after clicking Next on a user message keeps the current branch and Logseq changes"
        },
        head: "refreshed",
        source: "u1Original",
        destination: "u1Edited",
        answer: "a1Edited",
        sourceNumber: 1,
        destinationNumber: 2
    },
    {
        role: "assistant",
        direction: "Previous",
        titles: {
            confirm:
                "clicking previous icon on an assistant message navigates to the old reply branch",
            cancel: "canceling the confirmation after clicking Previous on an assistant message keeps the current branch and Logseq changes"
        },
        head: "refreshed",
        source: "a1Refreshed",
        destination: "a1Original",
        answer: "a1Original",
        sourceNumber: 2,
        destinationNumber: 1
    },
    {
        role: "assistant",
        direction: "Next",
        titles: {
            confirm:
                "clicking next icon on an assistant message navigates to the newer reply branch",
            cancel: "canceling the confirmation after clicking Next on an assistant message keeps the current branch and Logseq changes"
        },
        head: "original",
        source: "a1Original",
        destination: "a1Refreshed",
        answer: "a1Refreshed",
        sourceNumber: 1,
        destinationNumber: 2
    }
] as const;

describe("Advanced branching", () => {
    const cleanup = async () => {
        await deletePagePermanently(P);
        await deletePagePermanently(Q);
    };
    beforeEach(cleanup, 60_000);
    afterAll(cleanup, 60_000);
    test("successful commit locks all earlier messages and prevents editing", {
        timeout: 60_000
    }, async ({chat, model, storage}) => {
        const context = {chat, model, storage};
        const setup = await setupAppliedBranch(context, "refreshed", [
            commitStep(),
            textStep(FINAL)
        ]);
        const {driver, id, pages, languageModel} = setup;
        await expect
            .element(driver.userMessage(1).getByRole("button", {name: "Next", exact: true}))
            .toBeEnabled();
        await expect
            .element(
                driver.assistantMessage(1).getByRole("button", {name: "Previous", exact: true})
            )
            .toBeEnabled();
        await driver.sendMessage("Commit the two created pages now.");
        await driver.reviewAndCommit();
        await expect
            .element(driver.assistantMessage(4).getByText(FINAL, {exact: true}))
            .toBeVisible();
        const repository = await waitForSavedConversation(id, FINAL);
        await expectCommit(repository, "committed");
        expect(repository.messages).toHaveLength(13);
        const commitUser = nodeWithText(repository, "Commit the two created pages now.");
        const commitAssistant = nodeWithText(repository, FINAL);
        expect(commitUser.parentId).toBe(setup.repository.headId);
        expect(commitAssistant.parentId).toBe(commitUser.message.id);
        expect(repository.headId).toBe(commitAssistant.message.id);
        for (let index = 0; index < 5; index++) {
            await expectEditable(driver, index, false);
            await expect
                .element(
                    driver.assistantMessage(index).getByRole("button", {name: "Copy", exact: true})
                )
                .toBeEnabled();
        }
        await expectBranchCounter(driver.userMessage(1), 1);
        await expectBranchCounter(driver.assistantMessage(1), 2);
        for (const message of [driver.userMessage(1), driver.assistantMessage(1)]) {
            for (const name of ["Previous", "Next"])
                await expect
                    .element(message.getByRole("button", {name, exact: true}))
                    .toBeDisabled();
        }
        await expectPages(pages, true);
        expect(languageModel.doStreamCalls).toHaveLength(6);
        expectToolResultInPrompt(
            languageModel.doStreamCalls[5].prompt,
            "commit",
            findToolPart(repository, "commit").result
        );
    });

    for (const choice of ["confirm", "cancel"] as const) {
        for (const scenario of navigationCases) {
            test(scenario.titles[choice], {
                timeout: 60_000
            }, async ({chat, model, storage}) => {
                const context = {chat, model, storage};
                const setup = await setupAppliedBranch(context, scenario.head);
                const {driver, preset, pages, id, location, repository, languageModel} = setup;
                const runsBeforeNavigation = model.runs.length;
                const message =
                    scenario.role === "user" ? driver.userMessage(1) : driver.assistantMessage(1);
                await expectBranchCounter(message, scenario.sourceNumber);
                await message.getByRole("button", {name: scenario.direction, exact: true}).click();
                await expect.element(page.getByText(GUARD, {exact: true})).toBeVisible();
                await expect
                    .element(message.getByText(preset.texts[scenario.source], {exact: true}))
                    .toBeVisible();
                await expectBranchCounter(message, scenario.sourceNumber);
                expect(normalizeRepository(await loadRepository(id))).toEqual(setup.snapshot);
                await expectPages(pages, true);
                await driver.confirmModal(choice === "confirm" ? "revert-and-switch" : "cancel");
                if (choice === "cancel") {
                    await expect
                        .element(message.getByText(preset.texts[scenario.source], {exact: true}))
                        .toBeVisible();
                    await expectBranchCounter(message, scenario.sourceNumber);
                    await expect
                        .element(
                            message.getByRole("button", {name: scenario.direction, exact: true})
                        )
                        .toBeEnabled();
                    expect(normalizeRepository(await loadRepository(id))).toEqual(setup.snapshot);
                    expectTracker(await loadRepository(id), 2, 2, location);
                    await expect
                        .element(driver.assistantMessage(3).getByText(Q_ANSWER, {exact: true}))
                        .toBeVisible();
                    await expectPages(pages, true);
                } else {
                    await expect
                        .element(
                            message.getByText(preset.texts[scenario.destination], {exact: true})
                        )
                        .toBeVisible();
                    await expect
                        .element(
                            driver
                                .assistantMessage(1)
                                .getByText(preset.texts[scenario.answer], {exact: true})
                        )
                        .toBeVisible();
                    await expectBranchCounter(message, scenario.destinationNumber);
                    await expect
                        .element(
                            driver.root.getByText(preset.texts[scenario.source], {exact: true})
                        )
                        .not.toBeInTheDocument();
                    await expect
                        .element(driver.root.getByText(Q_ANSWER, {exact: true}))
                        .not.toBeInTheDocument();
                    await expectPages(pages, false);
                    const saved = await loadRepository(id);
                    expectTracker(saved, 2, 0, location);
                    // Branch selection is runtime-only; the last appended head remains durable.
                    expect(saved.headId).toBe(repository.headId);
                    expect(
                        saved.messages.map(({message, parentId}) => [message.id, parentId])
                    ).toEqual(
                        repository.messages.map(({message, parentId}) => [message.id, parentId])
                    );
                    expectOriginalNodesRetained(saved, repository, location);
                }
                expect(languageModel.doStreamCalls).toHaveLength(4);
                expect(model.runs).toHaveLength(runsBeforeNavigation);
            });
        }
    }

    test("confirming Refresh on an earlier assistant message creates a new reply branch and reverts uncommitted Logseq changes", {
        timeout: 60_000
    }, async ({chat, model, storage}) => {
        const context = {chat, model, storage};
        const replacement = "Regenerated P response sentinel.";
        const setup = await setupAppliedBranch(context, "refreshed", [textStep(replacement)]);
        const {driver, repository, id, pages, location, languageModel} = setup;
        await driver.clickRefresh(2);
        await expect.element(page.getByText(GUARD, {exact: true})).toBeVisible();
        await expectPages(pages, true);
        await driver.confirmModal("revert-and-switch");
        await expect
            .element(driver.assistantMessage(2).getByText(replacement, {exact: true}))
            .toBeVisible();
        await expectBranchCounter(driver.assistantMessage(2), 2);
        await expect
            .element(driver.root.getByText(P_ANSWER, {exact: true}))
            .not.toBeInTheDocument();
        await expect
            .element(driver.root.getByText(Q_ANSWER, {exact: true}))
            .not.toBeInTheDocument();
        const saved = await waitForSavedConversation(id, replacement);
        expect(saved.messages).toHaveLength(repository.messages.length + 1);
        const original = nodeWithText(repository, P_ANSWER);
        const regenerated = nodeWithText(saved, replacement);
        expect(regenerated.message.id).not.toBe(original.message.id);
        expect(regenerated.parentId).toBe(original.parentId);
        expect(saved.headId).toBe(regenerated.message.id);
        expect(nodeWithText(saved, P_ANSWER)).toEqual(original);
        expect(nodeWithText(saved, Q_REQUEST)).toEqual(nodeWithText(repository, Q_REQUEST));
        expectTracker(saved, 2, 0, location);
        expectOriginalNodesRetained(saved, repository, location);
        await expectPages(pages, false);
        expect(languageModel.doStreamCalls).toHaveLength(5);
        const prompt = JSON.stringify(languageModel.doStreamCalls[4].prompt);
        expect(prompt).toContain(P_REQUEST);
        for (const excluded of [P_ANSWER, Q_REQUEST, Q_ANSWER, "create-p", "create-q"])
            expect(prompt).not.toContain(excluded);
    });

    test("confirming an earlier message edit creates a new branch and reverts uncommitted Logseq changes", {
        timeout: 60_000
    }, async ({chat, model, storage}) => {
        const context = {chat, model, storage};
        const edited = "Replacement P question sentinel.";
        const answer = "Replacement P answer sentinel.";
        const setup = await setupAppliedBranch(context, "refreshed", [textStep(answer)]);
        const {driver, repository, id, pages, location, languageModel} = setup;
        const editor = await driver.beginEdit(2);
        await editor.getByRole("textbox").fill(edited);
        await editor.getByRole("button", {name: "Update", exact: true}).click();
        await expect.element(page.getByText(GUARD, {exact: true})).toBeVisible();
        await expectPages(pages, true);
        await driver.confirmModal("revert-and-switch");
        await expect
            .element(driver.assistantMessage(2).getByText(answer, {exact: true}))
            .toBeVisible();
        await expectBranchCounter(driver.userMessage(2), 2);
        await expect.element(driver.userMessage(2).getByText(edited, {exact: true})).toBeVisible();
        await expect
            .element(driver.root.getByText(P_REQUEST, {exact: true}))
            .not.toBeInTheDocument();
        const saved = await waitForSavedConversation(id, answer);
        expect(saved.messages).toHaveLength(repository.messages.length + 2);
        const original = nodeWithText(repository, P_REQUEST);
        const newUser = nodeWithText(saved, edited);
        const newAssistant = nodeWithText(saved, answer);
        expect(newUser.message.id).not.toBe(original.message.id);
        expect(newUser.parentId).toBe(original.parentId);
        expect(newAssistant.parentId).toBe(newUser.message.id);
        expect(saved.headId).toBe(newAssistant.message.id);
        for (const text of [P_REQUEST, P_ANSWER, Q_REQUEST])
            expect(nodeWithText(saved, text)).toEqual(nodeWithText(repository, text));
        expectTracker(saved, 2, 0, location);
        expectOriginalNodesRetained(saved, repository, location);
        await expectPages(pages, false);
        await expect
            .element(driver.root.getByText(Q_ANSWER, {exact: true}))
            .not.toBeInTheDocument();
        expect(languageModel.doStreamCalls).toHaveLength(5);
        const prompt = JSON.stringify(languageModel.doStreamCalls[4].prompt);
        expect(prompt).toContain(edited);
        for (const excluded of [P_REQUEST, P_ANSWER, Q_REQUEST, Q_ANSWER])
            expect(prompt).not.toContain(excluded);
    });

    const laterActionTitles: Record<"refresh" | "edit", string> = {
        refresh:
            "refreshing a later assistant message also reverts earlier uncommitted Logseq changes",
        edit: "editing a later user message also reverts earlier uncommitted Logseq changes"
    };
    for (const action of ["refresh", "edit"] as const) {
        test(laterActionTitles[action], {timeout: 60_000}, async ({chat, model, storage}) => {
            const replacementQuestion = "Replacement later Q question sentinel.";
            const replacementAnswer = `Replacement later Q ${action} answer sentinel.`;
            const setup = await setupAppliedBranch({chat, model, storage}, "refreshed", [
                textStep(replacementAnswer)
            ]);
            const {driver, repository, id, pages, location, languageModel} = setup;
            if (action === "refresh") {
                await driver.clickRefresh(3);
            } else {
                const editor = await driver.beginEdit(3);
                await editor.getByRole("textbox").fill(replacementQuestion);
                await editor.getByRole("button", {name: "Update", exact: true}).click();
            }
            await expect.element(page.getByText(GUARD, {exact: true})).toBeVisible();
            await expectPages(pages, true);
            expect(normalizeRepository(await loadRepository(id))).toEqual(setup.snapshot);
            await driver.confirmModal("revert-and-switch");
            await expect
                .element(driver.assistantMessage(3).getByText(replacementAnswer, {exact: true}))
                .toBeVisible();
            await expect
                .element(driver.assistantMessage(2).getByText(P_ANSWER, {exact: true}))
                .toBeVisible();
            await expect
                .element(driver.root.getByText(Q_ANSWER, {exact: true}))
                .not.toBeInTheDocument();
            await expectBranchCounter(
                action === "refresh" ? driver.assistantMessage(3) : driver.userMessage(3),
                2
            );

            const saved = await waitForSavedConversation(id, replacementAnswer);
            expect(saved.messages).toHaveLength(
                repository.messages.length + (action === "refresh" ? 1 : 2)
            );
            const newAssistant = nodeWithText(saved, replacementAnswer);
            if (action === "refresh") {
                expect(newAssistant.parentId).toBe(nodeWithText(repository, Q_ANSWER).parentId);
                expect(newAssistant.message.id).not.toBe(
                    nodeWithText(repository, Q_ANSWER).message.id
                );
            } else {
                const newUser = nodeWithText(saved, replacementQuestion);
                expect(newUser.parentId).toBe(nodeWithText(repository, Q_REQUEST).parentId);
                expect(newUser.message.id).not.toBe(nodeWithText(repository, Q_REQUEST).message.id);
                expect(newAssistant.parentId).toBe(newUser.message.id);
                await expect
                    .element(driver.userMessage(3).getByText(replacementQuestion, {exact: true}))
                    .toBeVisible();
            }
            expect(saved.headId).toBe(newAssistant.message.id);
            expectOriginalNodesRetained(saved, repository, location);
            expectTracker(saved, 2, 0, location);
            // Q is the edited/refreshed suffix; rolling back P proves whole-branch semantics.
            await expectPages([pages[0]], false);
            await expectPages([pages[1]], false);
            expect(languageModel.doStreamCalls).toHaveLength(5);
            const prompt = languageModel.doStreamCalls[4].prompt;
            expectToolResultInPrompt(prompt, "create-p", findToolPart(saved, "create-p").result);
            const serializedPrompt = JSON.stringify(prompt);
            for (const included of [
                P_REQUEST,
                P_ANSWER,
                action === "refresh" ? Q_REQUEST : replacementQuestion
            ])
                expect(serializedPrompt).toContain(included);
            for (const excluded of [
                Q_ANSWER,
                "create-q",
                ...(action === "edit" ? [Q_REQUEST] : [])
            ])
                expect(serializedPrompt).not.toContain(excluded);
        });
    }

    test("canceling the Revert & Switch confirmation keeps the edit draft until Cancel is clicked in the editor", {
        timeout: 60_000
    }, async ({chat, model, storage}) => {
        const context = {chat, model, storage};
        const setup = await setupAppliedBranch(context);
        const {driver, id, pages, languageModel} = setup;
        const draft = "Keep this unsent edit draft sentinel.";
        const editor = await driver.beginEdit(2);
        await editor.getByRole("textbox").fill(draft);
        await editor.getByRole("button", {name: "Update", exact: true}).click();
        await expect.element(page.getByText(GUARD, {exact: true})).toBeVisible();
        await driver.confirmModal("cancel");
        await expect.element(editor.getByRole("textbox")).toHaveValue(draft);
        await expect
            .element(editor.getByRole("button", {name: "Update", exact: true}))
            .toBeEnabled();
        expect(normalizeRepository(await loadRepository(id))).toEqual(setup.snapshot);
        await expectPages(pages, true);
        await editor.getByRole("button", {name: "Cancel", exact: true}).click();
        await expect.element(editor).not.toBeInTheDocument();
        await expect
            .element(driver.userMessage(2).getByText(P_REQUEST, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.assistantMessage(3).getByText(Q_ANSWER, {exact: true}))
            .toBeVisible();
        expect(normalizeRepository(await loadRepository(id))).toEqual(setup.snapshot);
        expect(languageModel.doStreamCalls).toHaveLength(4);
    });

    test("clicking Update without changing the message closes editing without prompting or reverting Logseq changes", {
        timeout: 60_000
    }, async ({chat, model, storage}) => {
        const context = {chat, model, storage};
        const setup = await setupAppliedBranch(context);
        const {driver, pages, id, languageModel} = setup;
        const editor = await driver.beginEdit(2);
        await expect.element(editor.getByRole("textbox")).toHaveValue(P_REQUEST);
        await editor.getByRole("button", {name: "Update", exact: true}).click();
        await expect.element(editor).not.toBeInTheDocument();
        await expect.element(page.getByText(GUARD, {exact: true})).not.toBeInTheDocument();
        expect(normalizeRepository(await loadRepository(id))).toEqual(setup.snapshot);
        expectTracker(await loadRepository(id), 2, 2, setup.location);
        await expectPages(pages, true);
        expect(languageModel.doStreamCalls).toHaveLength(4);
    });

    test("switching branches after reverting Logseq changes does not prompt or reapply those changes", {
        timeout: 60_000
    }, async ({chat, model, storage}) => {
        const context = {chat, model, storage};
        const setup = await setupAppliedBranch(context);
        const {driver, pages, id, languageModel} = setup;
        const trigger = driver.root.getByRole("button", {name: "Uncommitted changes", exact: true});
        await trigger.click();
        await page.getByRole("button", {name: "Revert", exact: true}).click();
        await expect
            .poll(async () =>
                trackerAt(await loadRepository(id), setup.location).tracker.getAppliedCommandCount()
            )
            .toBe(0);
        expectTracker(await loadRepository(id), 2, 0, setup.location);
        await expectPages(pages, false);
        await trigger.click();
        await expect
            .element(page.getByText("Not applied uncommitted changes", {exact: true}))
            .toBeVisible();
        await trigger.click();
        const snapshot = normalizeRepository(await loadRepository(id));
        await driver
            .assistantMessage(1)
            .getByRole("button", {name: "Previous", exact: true})
            .click();
        await expect
            .element(
                driver.assistantMessage(1).getByText(setup.preset.texts.a1Original, {exact: true})
            )
            .toBeVisible();
        await expectBranchCounter(driver.assistantMessage(1), 1);
        await expect.element(page.getByText(GUARD, {exact: true})).not.toBeInTheDocument();
        expect(normalizeRepository(await loadRepository(id))).toEqual(snapshot);
        await expectPages(pages, false);
        expect(languageModel.doStreamCalls).toHaveLength(4);
    });

    test("editing a message sent after commit creates a new branch while earlier messages stay locked", {
        timeout: 60_000
    }, async ({chat, model, storage}) => {
        const context = {chat, model, storage};
        const question = "Later editable question sentinel.";
        const original = "Later original answer sentinel.";
        const edited = "Later edited question sentinel.";
        const answer = "Later edited answer sentinel.";
        const setup = await setupAppliedBranch(context, "refreshed", [
            commitStep(),
            textStep(FINAL),
            textStep(original),
            textStep(answer)
        ]);
        const {driver, pages, id, languageModel} = setup;
        await driver.sendMessage("Commit the created pages before the next turn.");
        await driver.reviewAndCommit();
        await waitForSavedConversation(id, FINAL);
        await driver.sendMessage(question);
        const before = await waitForSavedConversation(id, original);
        await expectEditable(driver, 4, false);
        await expectEditable(driver, 5, true);
        const editor = await driver.beginEdit(5);
        await editor.getByRole("textbox").fill(edited);
        await editor.getByRole("button", {name: "Update", exact: true}).click();
        await expect
            .element(driver.assistantMessage(5).getByText(answer, {exact: true}))
            .toBeVisible();
        await expect.element(page.getByText(GUARD, {exact: true})).not.toBeInTheDocument();
        const saved = await waitForSavedConversation(id, answer);
        expect(saved.messages).toHaveLength(before.messages.length + 2);
        for (const node of before.messages)
            expect(saved.messages.find(({message}) => message.id === node.message.id)).toEqual(
                node
            );
        const newUser = nodeWithText(saved, edited);
        const newAssistant = nodeWithText(saved, answer);
        expect(newUser.message.id).not.toBe(nodeWithText(before, question).message.id);
        expect(newAssistant.message.id).not.toBe(nodeWithText(before, original).message.id);
        expect(newUser.parentId).toBe(nodeWithText(before, question).parentId);
        expect(newAssistant.parentId).toBe(newUser.message.id);
        expect(saved.headId).toBe(newAssistant.message.id);
        await expectCommit(saved, "committed");
        await expectPages(pages, true);
        await expectEditable(driver, 4, false);
        await expectEditable(driver, 5, true);
        expect(languageModel.doStreamCalls).toHaveLength(8);
        const prompt = JSON.stringify(languageModel.doStreamCalls[7].prompt);
        for (const included of [P_REQUEST, Q_REQUEST, FINAL, edited])
            expect(prompt).toContain(included);
        for (const excluded of [question, original]) expect(prompt).not.toContain(excluded);
        expectToolResultInPrompt(
            languageModel.doStreamCalls[7].prompt,
            "commit",
            findToolPart(saved, "commit").result
        );
    });

    test("closing review keeps commit pending and approving after reopening restores the same Logseq page", {
        timeout: 60_000
    }, async ({chat, model, storage}) => {
        const context = {chat, model, storage};
        const {driver, languageModel, id, pages} = await setupPendingCommit(context);
        await driver.reviewAndCommit("close");
        const pending = await loadRepository(id);
        expect(pending.messages).toHaveLength(2);
        expect(pending.messages.at(-1)?.message.status.type).toBe("requires-action");
        expect(findToolPart(pending, "commit").result).toBeUndefined();
        expectTracker(pending, 1, 0);
        await expectPages(pages, false);
        await expect
            .element(driver.root.getByRole("button", {name: "Stop generating", exact: true}))
            .toBeVisible();
        expect(languageModel.doStreamCalls).toHaveLength(2);
        await driver.reviewAndCommit("commit");
        await expect
            .element(driver.assistantMessage(0).getByText(FINAL, {exact: true}))
            .toBeVisible();
        const saved = await waitForSavedConversation(id, FINAL);
        expect(saved.messages).toHaveLength(2);
        expect(saved.headId).toBe(saved.messages[1].message.id);
        await expectCommit(saved, "committed");
        await expectPages(pages, true);
        expect(languageModel.doStreamCalls).toHaveLength(3);
        expectToolResultInPrompt(
            languageModel.doStreamCalls[2].prompt,
            "commit",
            findToolPart(saved, "commit").result
        );
    });

    test("rejecting a commit reverts Logseq changes and shows an assistant follow-up without locking messages", {
        timeout: 60_000
    }, async ({chat, model, storage}) => {
        const context = {chat, model, storage};
        const {driver, languageModel, id, pages} = await setupPendingCommit(context);
        await driver.reviewAndCommit("discard");
        await expect
            .element(driver.assistantMessage(0).getByText(FINAL, {exact: true}))
            .toBeVisible();
        const saved = await waitForSavedConversation(id, FINAL);
        expect(saved.messages).toHaveLength(2);
        expect(saved.headId).toBe(saved.messages[1].message.id);
        const part = findToolPart(saved, "commit");
        expect(part.isError).toBe(true);
        expect(part.result).toMatchObject({
            success: false,
            error: expect.stringContaining("commit was declined")
        });
        expectTracker(saved, 0, 0);
        await expectPages(pages, false);
        await expectEditable(driver, 0, true);
        expect(languageModel.doStreamCalls).toHaveLength(3);
        expectToolResultInPrompt(
            languageModel.doStreamCalls[2].prompt,
            "commit",
            part.result,
            true
        );
    });

    test("deferring commit stops the response and keeps uncommitted Logseq changes unapplied", {
        timeout: 60_000
    }, async ({chat, model, storage}) => {
        const context = {chat, model, storage};
        const {driver, languageModel, id, pages} = await setupPendingCommit(context, false);
        await driver.reviewAndCommit("defer");
        await expect
            .element(driver.root.getByRole("button", {name: "Send message", exact: true}))
            .toBeVisible();
        await expect
            .element(driver.root.getByRole("button", {name: "Stop generating", exact: true}))
            .not.toBeInTheDocument();
        await expect
            .poll(async () => (await loadRepository(id)).messages.at(-1)?.message.status)
            .toEqual({type: "incomplete", reason: "cancelled"});
        const saved = await loadRepository(id);
        const part = findToolPart(saved, "commit");
        expect(part.isError).toBe(true);
        expect(part.result).toMatchObject({
            success: false,
            error: "Changes not committed. User has decided he will commit later after further changes."
        });
        expectTracker(saved, 1, 0);
        await expectPages(pages, false);
        await expectEditable(driver, 0, true);
        expect(saved.messages).toHaveLength(2);
        expect(languageModel.doStreamCalls).toHaveLength(2);
    });

    test("committing with no pending Logseq changes skips review and keeps messages editable", {
        timeout: 60_000
    }, async ({chat, model}) => {
        const languageModel = model.respondWith([commitStep(), textStep(FINAL)]);
        const driver = await chat.mount();
        await driver.sendMessage("Commit with no pending graph changes.");
        await expect
            .element(driver.assistantMessage(0).getByText(FINAL, {exact: true}))
            .toBeVisible();
        await expect
            .element(driver.root.getByRole("button", {name: "Review & Commit", exact: true}))
            .not.toBeInTheDocument();
        await expect
            .element(page.getByText("Review uncommitted changes", {exact: true}))
            .not.toBeInTheDocument();
        await expect.poll(async () => (await ThreadStore.listThreads()).length).toBe(1);
        const id = (await ThreadStore.listThreads())[0].remoteId;
        const repository = await waitForSavedConversation(id, FINAL);
        expect(repository.messages).toHaveLength(2);
        expect(repository.messages[0].parentId).toBeNull();
        expect(repository.messages[1].parentId).toBe(repository.messages[0].message.id);
        expect(repository.headId).toBe(repository.messages[1].message.id);
        await expectCommit(repository, "no-changes");
        await expectEditable(driver, 0, true);
        expect(languageModel.doStreamCalls).toHaveLength(2);
        expectToolResultInPrompt(
            languageModel.doStreamCalls[1].prompt,
            "commit",
            findToolPart(repository, "commit").result
        );
    });
});
