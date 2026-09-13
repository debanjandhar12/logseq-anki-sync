import pTimeout from "p-timeout";
import {afterAll, beforeAll, describe, expect, vi} from "vitest";
import {page} from "vitest/browser";
import {LogseqCreatePageTool} from "../../../src/chat-app/tools/impl/LogseqCreatePageTool";
import {findLastLogseqReversibleTransactionTracker} from "../../../src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {isPageSoftDeleted} from "../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";
import {ThreadStore} from "../../../src/core/stores/thread-store/ThreadStore";
import {expectToolResultInPrompt} from "../../helpers/chat-scenario/assertions/expectToolResultInPrompt";
import {findToolPart} from "../../helpers/chat-scenario/assertions/findToolPart";
import {normalizeRepository} from "../../helpers/chat-scenario/assertions/normalizeRepository";
import {waitForSavedConversation} from "../../helpers/chat-scenario/assertions/waitForSavedConversation";
import {createToolPassthroughSpy} from "../../helpers/chat-scenario/createToolPassthroughSpy";
import {test} from "../../helpers/chat-scenario/fixtures";
import {buildLinearThread} from "../../helpers/chat-scenario/threadBuilders";
import {deletePagePermanently} from "../../helpers/logseq/deletePagePermanently";
import {reasoningSegment} from "../../helpers/mock-language-model/builders/reasoningSegment";
import {textSegment} from "../../helpers/mock-language-model/builders/textSegment";
import {toolCallsSegment} from "../../helpers/mock-language-model/builders/toolCallsSegment";

describe("Assistant message UI", {timeout: 60_000}, () => {
    const cleanup = async () => {
        for (const name of [
            "test-ai-chat-assistant-reasoning",
            "test-ai-chat-assistant-commit",
            "test-ai-chat-assistant-clear",
            "test-ai-chat-assistant-sequential-p",
            "test-ai-chat-assistant-sequential-q"
        ])
            await deletePagePermanently(name);
    };
    beforeAll(cleanup, 60_000);
    afterAll(cleanup, 60_000);
    test("clicking Copy on an assistant message copies its original Markdown and shows copied feedback", async ({
        chat,
        storage,
        model
    }) => {
        const raw =
            "**Raw clipboard sentinel**\n\n[Literal link](https://example.com/raw?q=1)\n\n- first\n- second";
        const thread = buildLinearThread({
            id: "assistant-copy",
            turns: [{user: "Copy this source.", assistant: raw}]
        });
        await storage.seedThread(thread);
        const driver = await chat.mount();
        await driver.openThread(thread.title!, "Raw clipboard sentinel");
        const copy = driver
            .assistantMessage(0)
            .getBySlot("aui_assistant-message-footer")
            .getByRole("button", {name: "Copy", exact: true});
        const previousIcon = copy.element().querySelector("svg");
        // Observe the browser API boundary, not the OS clipboard.
        const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
        try {
            await copy.click();
            await expect.poll(() => clipboard.mock.calls).toEqual([[raw]]);
            // The existing feedback is an unnamed check icon replacing the copy icon.
            await expect
                .poll(() => copy.element().querySelector("svg") !== previousIcon)
                .toBe(true);
            expect(copy.element().querySelector("svg")).not.toBeNull();
        } finally {
            clipboard.mockRestore();
        }
        expect(
            normalizeRepository(
                (await ThreadStore.loadThread(thread.remoteId))!.exportedMessageRepository
            )
        ).toEqual(normalizeRepository(thread.exportedMessageRepository));
        expect(model.runs).toHaveLength(0);
    });

    test("assistant messages display tables, links and bold text without changing the original Markdown", async ({
        chat,
        storage,
        model
    }) => {
        const raw =
            "**Bold sentinel** and [Documentation](https://example.com/docs?source=chat).\n\n| Item | State |\n| --- | --- |\n| Page sentinel | Ready sentinel |";
        const thread = buildLinearThread({
            id: "assistant-gfm",
            turns: [{user: "Render GFM.", assistant: raw}]
        });
        await storage.seedThread(thread);
        const driver = await chat.mount();
        await driver.openThread(thread.title!, "Bold sentinel");
        const message = driver.assistantMessage(0);
        const bold = message.getByText("Bold sentinel", {exact: true});
        await expect.element(bold).toBeVisible();
        expect(bold.element().tagName).toBe("STRONG");
        expect(
            Number.parseInt(getComputedStyle(bold.element()).fontWeight, 10)
        ).toBeGreaterThanOrEqual(600);
        await expect
            .element(message.getByRole("link", {name: "Documentation", exact: true}))
            .toHaveAttribute("href", "https://example.com/docs?source=chat");
        const table = message.getByRole("table");
        for (const name of ["Item", "State"]) {
            const header = table.getByRole("cell", {name, exact: true});
            await expect.element(header).toBeVisible();
            expect(header.element().tagName).toBe("TH");
        }
        for (const name of ["Page sentinel", "Ready sentinel"])
            await expect.element(table.getByRole("cell", {name, exact: true})).toBeVisible();
        expect(
            normalizeRepository(
                (await ThreadStore.loadThread(thread.remoteId))!.exportedMessageRepository
            )
        ).toEqual(normalizeRepository(thread.exportedMessageRepository));
        expect(model.runs).toHaveLength(0);
    });

    test("code blocks show their language, preserve code whitespace and have a separate Copy button", async ({
        chat,
        storage,
        model
    }) => {
        const code = 'const greeting: string = "hello";\n  greeting.trim();\n';
        const raw = `Code sentinel\n\n\`\`\`ts\n${code}\`\`\``;
        const thread = buildLinearThread({
            id: "assistant-code",
            turns: [{user: "Render code.", assistant: raw}]
        });
        await storage.seedThread(thread);
        const driver = await chat.mount();
        await driver.openThread(thread.title!, "Code sentinel");
        const message = driver.assistantMessage(0);
        const language = message.getByText("ts", {exact: true});
        await expect.element(language).toBeVisible();
        const header = language.element().parentElement!;
        expect(header.nextElementSibling?.tagName).toBe("PRE");
        await expect
            .poll(() => header.nextElementSibling?.querySelector("code")?.textContent)
            .toBe(code);
        await expect
            .element(page.elementLocator(header).getByRole("button", {name: "Copy", exact: true}))
            .toBeVisible();
        await expect
            .element(
                message
                    .getBySlot("aui_assistant-message-footer")
                    .getByRole("button", {name: "Copy", exact: true})
            )
            .toBeVisible();
        expect(
            normalizeRepository(
                (await ThreadStore.loadThread(thread.remoteId))!.exportedMessageRepository
            )
        ).toEqual(normalizeRepository(thread.exportedMessageRepository));
        expect(model.runs).toHaveLength(0);
    });

    test("expanding Reasoning shows the page-creation tool and its result separately from the final answer", async ({
        chat,
        model
    }) => {
        const pageName = "test-ai-chat-assistant-reasoning";
        const answer = "The reasoning page is ready.";
        model.respondWith([
            {
                segments: [
                    reasoningSegment("I will create the requested page."),
                    toolCallsSegment([
                        {
                            toolCallId: "reasoning-create",
                            toolName: "logseq_create_page",
                            input: {pageName}
                        }
                    ])
                ]
            },
            {segments: [textSegment(answer)]}
        ]);
        const driver = await chat.mount();
        await driver.sendMessage("Create a page with reasoning.");
        const message = driver.assistantMessage(0);
        const final = message.getByText(answer, {exact: true});
        await expect.element(final).toBeVisible();
        expect(final.element().closest('[data-slot="reasoning-root"]')).toBeNull();
        await expect
            .element(message.getByRole("button", {name: /^Reasoning/}))
            .toHaveAttribute("aria-expanded", "false");
        await driver.expandReasoning(message);
        await expect
            .element(message.getByText("I will create the requested page.", {exact: true}))
            .toBeVisible();
        const create = message.getByRole("button", {name: /Used tool: logseq_create_page/});
        await expect.element(create).toBeVisible();
        expect(create.element().closest('[data-slot="reasoning-root"]')).not.toBeNull();
        await expect
            .element(create.getBySlot("tool-fallback-trigger-icon"))
            .toHaveAttribute("aria-label", "Tool complete");
        await create.click();
        const [thread] = await ThreadStore.listThreads();
        const repository = await waitForSavedConversation(thread.remoteId, answer);
        const part = findToolPart(repository, "reasoning-create");
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
        await expect
            .element(message.getBySlot("reasoning-root").getByText(created!.uuid, {exact: false}))
            .toBeVisible();
    });

    test("the commit action stays outside Reasoning before and after approval", async ({
        chat,
        model
    }) => {
        const pageName = "test-ai-chat-assistant-commit";
        const answer = "The standalone commit succeeded.";
        const languageModel = model.respondWith([
            {
                segments: [
                    toolCallsSegment([
                        {
                            toolCallId: "standalone-create",
                            toolName: "logseq_create_page",
                            input: {pageName}
                        }
                    ])
                ]
            },
            {
                segments: [
                    toolCallsSegment([
                        {
                            toolCallId: "standalone-commit",
                            toolName: "logseq_commit_changes",
                            input: {}
                        }
                    ])
                ]
            },
            {segments: [textSegment(answer)]}
        ]);
        const driver = await chat.mount();
        await driver.sendMessage("Create and review a page.");
        const message = driver.assistantMessage(0);
        const review = message.getByRole("button", {name: "Review & Commit", exact: true});
        await expect.element(review).toBeVisible();
        await expect
            .element(message.getByRole("button", {name: /^Reasoning/}))
            .toHaveAttribute("aria-expanded", "false");
        expect(review.element().closest('[data-slot="reasoning-root"]')).toBeNull();
        const created = await logseq.Editor.getPage(pageName);
        await driver.reviewAndCommit();
        await expect.element(message.getByText(answer, {exact: true})).toBeVisible();
        const completed = message.getByRole("button", {name: /Used tool: logseq_commit_changes/});
        await expect.element(completed).toBeVisible();
        expect(completed.element().closest('[data-slot="reasoning-root"]')).toBeNull();
        await expect
            .element(completed.getBySlot("tool-fallback-trigger-icon"))
            .toHaveAttribute("aria-label", "Tool complete");
        const [thread] = await ThreadStore.listThreads();
        const repository = await waitForSavedConversation(thread.remoteId, answer);
        const part = findToolPart(repository, "standalone-commit");
        expect(part.result).toMatchObject({success: true, outcome: "committed"});
        expect(isPageSoftDeleted((await logseq.Editor.getPage(created!.uuid))!)).toBe(false);
        expectToolResultInPrompt(
            languageModel.doStreamCalls[2].prompt,
            "standalone-commit",
            part.result
        );
    }, 60_000);

    test("discarding uncommitted changes reverts the Logseq page and shows the clear action outside Reasoning", async ({
        chat,
        model
    }) => {
        const pageName = "test-ai-chat-assistant-clear";
        const answer = "The uncommitted changes were cleared.";
        // A passthrough observation captures the real UUID before the next tool reverts it.
        const spy = createToolPassthroughSpy(LogseqCreatePageTool.prototype, "execute");
        try {
            const languageModel = model.respondWith([
                {
                    segments: [
                        toolCallsSegment([
                            {
                                toolCallId: "clear-create",
                                toolName: "logseq_create_page",
                                input: {pageName}
                            }
                        ])
                    ]
                },
                {
                    segments: [
                        toolCallsSegment([
                            {
                                toolCallId: "standalone-clear",
                                toolName: "logseq_clear_uncommitted_changes",
                                input: {}
                            }
                        ])
                    ]
                },
                {segments: [textSegment(answer)]}
            ]);
            const driver = await chat.mount();
            await driver.sendMessage("Create then discard a page.");
            const message = driver.assistantMessage(0);
            await expect.element(message.getByText(answer, {exact: true})).toBeVisible();
            const clear = message.getByRole("button", {
                name: /Used tool: logseq_clear_uncommitted_changes/
            });
            await expect.element(clear).toBeVisible();
            expect(clear.element().closest('[data-slot="reasoning-root"]')).toBeNull();
            await expect
                .element(message.getByRole("button", {name: /^Reasoning/}))
                .toHaveAttribute("aria-expanded", "false");
            await expect
                .element(clear.getBySlot("tool-fallback-trigger-icon"))
                .toHaveAttribute("aria-label", "Tool complete");
            await driver.expandReasoning(message);
            const create = message.getByRole("button", {name: /Used tool: logseq_create_page/});
            await expect.element(create).toBeVisible();
            expect(create.element().closest('[data-slot="reasoning-root"]')).not.toBeNull();
            const [thread] = await ThreadStore.listThreads();
            const repository = await waitForSavedConversation(thread.remoteId, answer);
            const part = findToolPart(repository, "standalone-clear");
            expect(part.result).toEqual({success: true});
            const tracker = findLastLogseqReversibleTransactionTracker(
                repository.messages.map(({message}) => message)
            )!.tracker;
            expect(tracker.getCommands()).toHaveLength(0);
            expect(tracker.getAppliedCommandCount()).toBe(0);
            const result = spy.calls[0].result!.result;
            expect(result.success).toBe(true);
            if (!result.success || typeof result.page !== "object" || !("uuid" in result.page))
                throw new Error("Create tool did not return its real page UUID");
            const deleted = await logseq.Editor.getPage(result.page.uuid);
            expect(deleted === null || isPageSoftDeleted(deleted)).toBe(true);
            expectToolResultInPrompt(
                languageModel.doStreamCalls[2].prompt,
                "standalone-clear",
                part.result
            );
        } finally {
            try {
                await chat.unmount();
            } finally {
                await spy.dispose();
                spy.restore();
            }
        }
    }, 60_000);

    test("hovering an assistant message shows Copy and Refresh without a More menu", async ({
        chat,
        storage,
        model
    }) => {
        const thread = buildLinearThread({
            id: "assistant-no-more",
            turns: [{user: "Static question.", assistant: "Static answer."}]
        });
        await storage.seedThread(thread);
        const driver = await chat.mount();
        await driver.openThread(thread.title!, "Static answer.");
        const message = driver.assistantMessage(0);
        await message.hover();
        for (const name of ["Copy", "Refresh"])
            await expect.element(message.getByRole("button", {name, exact: true})).toBeVisible();
        await expect
            .element(message.getByRole("button", {name: /^(More|More options)$/}))
            .not.toBeInTheDocument();
        expect(model.runs).toHaveLength(0);
        expect(
            normalizeRepository(
                (await ThreadStore.loadThread(thread.remoteId))!.exportedMessageRepository
            )
        ).toEqual(normalizeRepository(thread.exportedMessageRepository));
    });

    test("requesting two pages creates them one at a time before the assistant replies", async ({
        chat,
        model
    }) => {
        const pageNames = [
            "test-ai-chat-assistant-sequential-p",
            "test-ai-chat-assistant-sequential-q"
        ];
        const reached = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const spy = createToolPassthroughSpy(LogseqCreatePageTool.prototype, "execute", {
            snapshot: ([, context]) => structuredClone(context?.messages ?? []),
            beforeCall: async (call, shutdownSignal) => {
                if (call.ordinal !== 1) return;
                reached.resolve();
                const signal = call.args[1]?.abortSignal;
                await pTimeout(
                    pTimeout(release.promise, {milliseconds: Infinity, signal: shutdownSignal}),
                    {milliseconds: Infinity, signal}
                );
            }
        });
        try {
            const answer = "Both sequential pages exist.";
            const languageModel = model.respondWith([
                {
                    segments: [
                        toolCallsSegment(
                            pageNames.map((pageName, index) => ({
                                toolCallId: `sequential-${index}`,
                                toolName: "logseq_create_page",
                                input: {pageName}
                            }))
                        )
                    ]
                },
                {segments: [textSegment(answer)]}
            ]);
            const driver = await chat.mount();
            await driver.sendMessage("Create two pages from a single tool batch.");
            await reached.promise;
            const message = driver.assistantMessage(0);
            await driver.expandReasoning(message);
            await expect
                .poll(
                    () =>
                        message
                            .getByRole("button", {name: /Used tool: logseq_create_page/})
                            .elements().length
                )
                .toBe(2);
            expect(spy.calls).toHaveLength(1);
            expect(spy.events).toEqual([{ordinal: 1, phase: "start"}]);
            expect(languageModel.doStreamCalls).toHaveLength(1);
            for (const name of pageNames) expect(await logseq.Editor.getPage(name)).toBeNull();
            release.resolve();
            await expect.element(message.getByText(answer, {exact: true})).toBeVisible();
            const [thread] = await ThreadStore.listThreads();
            const repository = await waitForSavedConversation(thread.remoteId, answer);
            expect(spy.events).toEqual([
                {ordinal: 1, phase: "start"},
                {ordinal: 1, phase: "end"},
                {ordinal: 2, phase: "start"},
                {ordinal: 2, phase: "end"}
            ]);
            expect(spy.maxInFlight).toBe(1);
            const first = findToolPart(repository, "sequential-0");
            const second = findToolPart(repository, "sequential-1");
            const observedFirst = spy.calls[1].snapshot
                .flatMap((message) => (message.role === "assistant" ? message.content : []))
                .find((part) => part.type === "tool-call" && part.toolCallId === "sequential-0");
            expect(observedFirst).toMatchObject({result: first.result, artifact: first.artifact});
            expect(first.artifact).toBeDefined();
            const tracker = findLastLogseqReversibleTransactionTracker(
                repository.messages.map(({message}) => message)
            )!.tracker;
            expect(tracker.getCommands()).toHaveLength(2);
            expect(tracker.getAppliedCommandCount()).toBe(2);
            const uuids = [];
            for (const [index, name] of pageNames.entries()) {
                const created = await logseq.Editor.getPage(name);
                expect(created).not.toBeNull();
                expect(isPageSoftDeleted(created!)).toBe(false);
                uuids.push(created!.uuid);
                const part = index === 0 ? first : second;
                expect(part.result).toMatchObject({success: true});
                expect(JSON.stringify(part.result)).toContain(created!.uuid);
                expectToolResultInPrompt(
                    languageModel.doStreamCalls[1].prompt,
                    `sequential-${index}`,
                    part.result
                );
            }
            expect(new Set(uuids).size).toBe(2);
            expect(languageModel.doStreamCalls).toHaveLength(2);
            const promptResults = languageModel.doStreamCalls[1].prompt.flatMap((message) =>
                message.role === "tool" ? message.content : []
            );
            expect(
                promptResults.map((part) =>
                    part.type === "tool-result" ? part.toolCallId : undefined
                )
            ).toEqual(["sequential-0", "sequential-1"]);
        } finally {
            try {
                await chat.unmount();
            } finally {
                await spy.dispose();
                spy.restore();
            }
        }
    }, 60_000);
});
