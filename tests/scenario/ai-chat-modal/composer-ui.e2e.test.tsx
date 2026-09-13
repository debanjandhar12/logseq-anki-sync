import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect} from "vitest";
import {page, userEvent} from "vitest/browser";
import {isPageSoftDeleted} from "../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";
import {ThreadStore} from "../../../src/core/stores/thread-store/ThreadStore";
import {findToolPart} from "../../helpers/chat-scenario/assertions/findToolPart";
import {waitForSavedConversation} from "../../helpers/chat-scenario/assertions/waitForSavedConversation";
import {test} from "../../helpers/chat-scenario/fixtures";
import {waitForAnimationFramesDouble} from "../../helpers/chat-scenario/timing";
import {COMMON_VIEWPORTS} from "../../helpers/chat-scenario/viewport";
import {deletePagePermanently} from "../../helpers/logseq/deletePagePermanently";
import {textSegment} from "../../helpers/mock-language-model/builders/textSegment";
import {toolCallsSegment} from "../../helpers/mock-language-model/builders/toolCallsSegment";

describe("Composer UI", {timeout: 60_000}, () => {
    let scrollPage: PageEntity;
    let attachmentPage: PageEntity;
    const blocks: BlockEntity[] = [];
    const cleanup = async () => {
        for (const name of [
            "test-ai-chat-composer-scroll",
            "test-ai-chat-composer-no-add",
            "test-ai-chat-composer-commit"
        ])
            await deletePagePermanently(name);
    };
    beforeAll(async () => {
        await cleanup();
        scrollPage = (await logseq.Editor.createPage(
            "test-ai-chat-composer-scroll",
            {},
            {redirect: false, createFirstBlock: false}
        ))!;
        attachmentPage = (await logseq.Editor.createPage(
            "test-ai-chat-composer-no-add",
            {},
            {redirect: false, createFirstBlock: false}
        ))!;
        for (let index = 0; index < 10; index++)
            blocks.push(
                (await logseq.Editor.appendBlockInPage(
                    scrollPage.uuid,
                    `Composer attachment ${index}`
                ))!
            );
    }, 60_000);
    afterAll(cleanup, 60_000);
    test("Shift+Enter inserts a newline without submitting and preserves it on send", async ({
        chat,
        model
    }) => {
        const answer = "The multiline question arrived.";
        const languageModel = model.respondWith([{segments: [textSegment(answer)]}]);
        const driver = await chat.mount();
        await driver.messageInput.click();
        await userEvent.keyboard("First line{Shift>}{Enter}{/Shift}");
        await expect.element(driver.messageInput).toHaveValue("First line\n");
        await expect
            .poll(() => (driver.messageInput.element() as HTMLTextAreaElement).selectionStart)
            .toBe("First line\n".length);
        await userEvent.keyboard("Second line");
        await expect.element(driver.messageInput).toHaveValue("First line\nSecond line");
        expect(model.runs).toHaveLength(0);
        expect(driver.root.getBySlot("aui_user-message-root").elements()).toHaveLength(0);
        await driver.root.getByRole("button", {name: "Send message", exact: true}).click();
        await expect
            .element(driver.assistantMessage(0).getByText(answer, {exact: true}))
            .toBeVisible();
        const [thread] = await ThreadStore.listThreads();
        const repository = await waitForSavedConversation(thread.remoteId, answer);
        expect(repository.messages[0].message.content).toEqual([
            {type: "text", text: "First line\nSecond line"}
        ]);
        expect(languageModel.doStreamCalls[0].prompt).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    role: "user",
                    content: [{type: "text", text: "First line\nSecond line"}]
                })
            ])
        );
    });

    test("resizing the chat reflows the full-width message input without losing the draft", async ({
        chat,
        model
    }) => {
        const driver = await chat.mount();
        await page.viewport(1280, 720);
        await document.fonts.ready;
        await Promise.all(
            driver.root
                .getByRole("dialog", {name: "AI chat", exact: true})
                .element()
                .getAnimations()
                .map((animation) => animation.finished)
        );
        const text = "Composer draft ".repeat(5);
        await driver.messageInput.fill(text);
        const shell = driver.root.getBySlot("aui_composer-shell");
        // Autosizing and caret restoration run on animation frames after controlled updates.
        await waitForAnimationFramesDouble();
        await expect
            .poll(() => {
                const input = driver.messageInput.element();
                const maximum = Number.parseFloat(getComputedStyle(input).maxHeight);
                expect(input.getBoundingClientRect().height).toBeLessThan(maximum);
                expect(
                    Math.abs(input.getBoundingClientRect().height - input.scrollHeight)
                ).toBeLessThanOrEqual(1);
                return true;
            })
            .toBe(true);
        const wideWidth = shell.element().getBoundingClientRect().width;
        const wideHeight = driver.messageInput.element().getBoundingClientRect().height;
        for (const {width, height} of COMMON_VIEWPORTS) {
            await page.viewport(width, height);
            await waitForAnimationFramesDouble();
            await expect.element(driver.messageInput).toHaveValue(text);
            await expect
                .poll(() => {
                    const element = shell.element();
                    const rect = element.getBoundingClientRect();
                    const allocation = element.parentElement!.getBoundingClientRect();
                    expect(Math.abs(rect.width - allocation.width)).toBeLessThanOrEqual(1);
                    expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
                    const input = driver.messageInput.element();
                    expect(input.scrollWidth).toBeLessThanOrEqual(input.clientWidth + 1);
                    if (width === 1280) {
                        expect(Math.abs(rect.width - wideWidth)).toBeLessThanOrEqual(1);
                        expect(
                            Math.abs(input.getBoundingClientRect().height - wideHeight)
                        ).toBeLessThanOrEqual(1);
                    } else {
                        expect(rect.width).toBeLessThan(wideWidth);
                        expect(input.getBoundingClientRect().height).toBeGreaterThan(wideHeight);
                        expect(input.getBoundingClientRect().height).toBeLessThanOrEqual(
                            Number.parseFloat(getComputedStyle(input).maxHeight) + 1
                        );
                    }
                    return true;
                })
                .toBe(true);
            for (const control of [
                driver.root.getByRole("button", {name: "Send message", exact: true}),
                driver.root.getByRole("combobox").filter({hasText: "Test provider / test-model"})
            ]) {
                await expect.element(control).toBeVisible();
                await expect.element(control).toBeInViewport({ratio: 1});
            }
        }
        await page.viewport(640, 600);
        const cappedText = text.repeat(10);
        await driver.messageInput.fill(cappedText);
        await expect
            .poll(() => {
                const input = driver.messageInput.element();
                const maximum = Number.parseFloat(getComputedStyle(input).maxHeight);
                expect(
                    Math.abs(input.getBoundingClientRect().height - maximum)
                ).toBeLessThanOrEqual(1);
                expect(input.scrollHeight).toBeGreaterThan(input.clientHeight);
                expect(input.scrollWidth).toBeLessThanOrEqual(input.clientWidth + 1);
                return true;
            })
            .toBe(true);
        await page.viewport(1280, 720);
        await expect.element(driver.messageInput).toHaveValue(cappedText);
        expect(model.runs).toHaveLength(0);
    });

    test("the attachment row scrolls horizontally without showing a scrollbar", async ({chat}) => {
        const driver = await chat.mount();
        await page.viewport(640, 600);
        for (const block of blocks)
            await driver.addAttachment(block.uuid, "Logseq block attachment", block.content!);
        const firstPill = driver.root
            .getBySlot("aui_composer-shell")
            .getByRole("button", {name: "Logseq block attachment", exact: true})
            .first();
        // The unnamed strip is the common parent of attachment wrappers.
        const strip = firstPill.element().parentElement!.parentElement!;
        expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth);
        expect(getComputedStyle(strip).overflowX).toMatch(/^(auto|scroll)$/);
        expect(getComputedStyle(strip).scrollbarWidth).toBe("none");
        expect(getComputedStyle(strip, "::-webkit-scrollbar").display).toBe("none");
        expect(strip.scrollHeight).toBeLessThanOrEqual(strip.clientHeight + 1);
        const before = firstPill.element().getBoundingClientRect().left;
        strip.scrollLeft = 100;
        await expect.poll(() => strip.scrollLeft).toBeGreaterThan(0);
        await expect
            .poll(() => firstPill.element().getBoundingClientRect().left)
            .toBeLessThan(before - 50);
    }, 60_000);

    test("the message input has no Add Attachment button before or after adding an attachment", async ({
        chat
    }) => {
        const livePage = attachmentPage;
        const driver = await chat.mount();
        const add = driver.root
            .getBySlot("aui_composer-shell")
            .getByRole("button", {name: "Add Attachment", exact: true});
        await expect.element(add).not.toBeInTheDocument();
        await driver.addAttachment(
            livePage.uuid,
            "Logseq page attachment",
            "test-ai-chat-composer-no-add"
        );
        await expect.element(add).not.toBeInTheDocument();
    });

    test("hovering Send shows its tooltip fully in view above the button", async ({chat}) => {
        const driver = await chat.mount();
        await driver.messageInput.fill("Enable the send tooltip.");
        const send = driver.root.getByRole("button", {name: "Send message", exact: true});
        await send.hover();
        const tooltip = page.getByRole("tooltip", {name: "Send message", exact: true});
        await expect.element(tooltip).toBeInTheDocument();
        // Radix's semantic tooltip is a hidden span inside the painted popup.
        const painted = page.elementLocator(tooltip.element().closest("[data-side]")!);
        await expect.element(painted).toBeVisible();
        await expect.element(painted).toHaveAttribute("data-side", "top");
        const intersection = await new Promise<IntersectionObserverEntry>((resolve) => {
            const observer = new IntersectionObserver(([entry]) => {
                observer.disconnect();
                resolve(entry);
            });
            observer.observe(painted.element());
        });
        // Chromium rounds the popper wrapper's clip to whole pixels (119 vs 119.40625px).
        // Check actual clipped edges, allowing at most half a CSS pixel on each edge.
        for (const edge of ["top", "right", "bottom", "left"] as const) {
            expect(
                Math.abs(
                    intersection.intersectionRect[edge] - intersection.boundingClientRect[edge]
                )
            ).toBeLessThanOrEqual(0.5);
        }
        await expect
            .poll(() => {
                const rect = painted.element().getBoundingClientRect();
                const bounds = driver.root.element().getBoundingClientRect();
                expect(rect.bottom).toBeLessThanOrEqual(
                    send.element().getBoundingClientRect().top + 1
                );
                expect(rect.top).toBeGreaterThanOrEqual(bounds.top - 1);
                expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
                expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
                expect(rect.top).toBeGreaterThanOrEqual(-0.5);
                expect(rect.left).toBeGreaterThanOrEqual(-0.5);
                expect(rect.right).toBeLessThanOrEqual(window.innerWidth + 0.5);
                expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight + 0.5);
                return true;
            })
            .toBe(true);
    });

    test("Stop stays available while commit awaits approval and Send returns after approval", async ({
        chat,
        model
    }) => {
        const pageName = "test-ai-chat-composer-commit";
        const answer = "The reviewed page is committed.";
        const languageModel = model.respondWith([
            {
                segments: [
                    toolCallsSegment([
                        {
                            toolCallId: "composer-create",
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
                            toolCallId: "composer-commit",
                            toolName: "logseq_commit_changes",
                            input: {}
                        }
                    ])
                ]
            },
            {segments: [textSegment(answer)]}
        ]);
        const driver = await chat.mount();
        await driver.sendMessage("Create a page and ask me to commit it.");
        await expect
            .element(driver.root.getByRole("button", {name: "Review & Commit", exact: true}))
            .toBeVisible();
        await expect
            .poll(async () => {
                const [thread] = await ThreadStore.listThreads();
                const repository = (await ThreadStore.loadThread(thread.remoteId))
                    ?.exportedMessageRepository;
                expect(repository?.messages.at(-1)?.message.status?.type).toBe("requires-action");
                expect(findToolPart(repository!, "composer-commit").result).toBeUndefined();
                return true;
            })
            .toBe(true);
        expect(languageModel.doStreamCalls).toHaveLength(2);
        await expect
            .element(driver.root.getByRole("button", {name: "Stop generating", exact: true}))
            .toBeVisible();
        await expect
            .element(driver.root.getByRole("button", {name: "Send message", exact: true}))
            .not.toBeInTheDocument();
        const created = await logseq.Editor.getPage(pageName);
        await driver.reviewAndCommit();
        await expect
            .element(driver.assistantMessage(0).getByText(answer, {exact: true}))
            .toBeVisible();
        const [thread] = await ThreadStore.listThreads();
        const repository = await waitForSavedConversation(thread.remoteId, answer);
        expect(findToolPart(repository, "composer-commit").result).toMatchObject({
            success: true,
            outcome: "committed"
        });
        expect(languageModel.doStreamCalls).toHaveLength(3);
        expect(isPageSoftDeleted((await logseq.Editor.getPage(created!.uuid))!)).toBe(false);
        await expect
            .element(driver.root.getByRole("button", {name: "Send message", exact: true}))
            .toBeVisible();
        await expect
            .element(driver.root.getByRole("button", {name: "Stop generating", exact: true}))
            .not.toBeInTheDocument();
    }, 60_000);

    test("opening the model selector keeps its popup fully in view in wide and short narrow windows", async ({
        chat,
        model
    }) => {
        const driver = await chat.mount();
        const trigger = driver.root
            .getByRole("combobox")
            .filter({hasText: "Test provider / test-model"});
        for (const [width, height] of [
            [1280, 720],
            [640, 600]
        ]) {
            await page.viewport(width, height);
            await expect.element(trigger).toBeVisible();
            await expect.element(trigger).toBeInViewport({ratio: 1});
            await trigger.click();
            await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
            const popup = page.getBySlot("model-selector-content");
            await expect.element(popup).toBeVisible();
            await expect.element(popup).toBeInViewport({ratio: 1});
            for (const name of ["test-model", "test-model2"])
                await expect.element(popup.getByRole("option", {name, exact: true})).toBeVisible();
            expect(
                popup.getBySlot("model-selector-list").element().getBoundingClientRect().height
            ).toBeLessThanOrEqual(201);
            await userEvent.keyboard("{Escape}");
            await expect.element(popup).not.toBeInTheDocument();
            await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
            await expect.element(driver.messageInput).toBeVisible();
            await expect
                .poll(() => trigger.element().textContent)
                .toMatch(/Test provider \/ test-model/);
        }
        expect(model.runs).toHaveLength(0);
    });
});
