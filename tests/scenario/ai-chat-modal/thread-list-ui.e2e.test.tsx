import {describe, expect} from "vitest";
import {page, userEvent} from "vitest/browser";
import {ThreadStore} from "../../../src/core/stores/thread-store/ThreadStore";
import {normalizeRepository} from "../../helpers/chat-scenario/assertions/normalizeRepository";
import {waitForSavedConversation} from "../../helpers/chat-scenario/assertions/waitForSavedConversation";
import {test} from "../../helpers/chat-scenario/fixtures";
import {buildThreadList} from "../../helpers/chat-scenario/threadBuilders";
import {COMMON_VIEWPORTS} from "../../helpers/chat-scenario/viewport";
import {textSegment} from "../../helpers/mock-language-model/builders/textSegment";
import {waitSegment} from "../../helpers/mock-language-model/builders/waitSegment";

describe("Thread list UI", () => {
    test("opening history lists saved conversations with the most recently updated first", async ({
        chat,
        storage,
        model
    }) => {
        const threads = buildThreadList({idPrefix: "history-list"});
        for (const thread of threads) await storage.seedThread(thread);
        const before = await ThreadStore.listThreads();
        const repositoriesBefore = await Promise.all(
            threads.map(async ({remoteId}) =>
                normalizeRepository(
                    (await ThreadStore.loadThread(remoteId))!.exportedMessageRepository
                )
            )
        );
        const driver = await chat.mount();
        await driver.openThreadHistory();
        await expect
            .element(driver.root.getByRole("button", {name: "Back to thread", exact: true}))
            .toBeVisible();
        await expect.element(driver.messageInput).not.toBeInTheDocument();
        const triggers = driver.root.getBySlot("aui_thread-list-item-trigger");
        await expect
            .poll(() => triggers.elements().map((element) => element.textContent?.trim()))
            .toEqual([...threads].reverse().map(({title}) => title));
        for (const thread of threads)
            await expect
                .element(driver.root.getByRole("button", {name: thread.title!, exact: true}))
                .toBeVisible();
        await chat.unmount();
        expect(await ThreadStore.listThreads()).toEqual(before);
        expect(
            await Promise.all(
                threads.map(async ({remoteId}) =>
                    normalizeRepository(
                        (await ThreadStore.loadThread(remoteId))!.exportedMessageRepository
                    )
                )
            )
        ).toEqual(repositoriesBefore);
        expect(model.runs).toHaveLength(0);
    });

    test("clicking a conversation in history shows its messages and marks it as current", async ({
        chat,
        storage,
        model
    }) => {
        const threads = buildThreadList({count: 2, idPrefix: "history-switch"});
        for (const thread of threads) await storage.seedThread(thread);
        const before = await Promise.all(
            threads.map(async ({remoteId}) =>
                normalizeRepository(
                    (await ThreadStore.loadThread(remoteId))!.exportedMessageRepository
                )
            )
        );
        const driver = await chat.mount();
        for (const index of [0, 1, 0]) {
            const selected = threads[index];
            const other = threads[1 - index];
            await driver.openThread(selected.title!, `History answer [${selected.remoteId}]`);
            await expect
                .element(
                    driver
                        .userMessage(0)
                        .getByText(`History question [${selected.remoteId}]`, {exact: true})
                )
                .toBeVisible();
            await expect
                .element(driver.root.getByText(`History answer [${other.remoteId}]`, {exact: true}))
                .not.toBeInTheDocument();
            await driver.openThreadHistory();
            await expect
                .element(
                    driver.root.getBySlot("aui_thread-list-item").filter({
                        has: page.getByRole("button", {
                            name: selected.title!,
                            exact: true
                        })
                    })
                )
                .toHaveAttribute("aria-current", "true");
            await driver.root.getByRole("button", {name: "Back to thread", exact: true}).click();
        }
        await chat.unmount();
        expect(
            await Promise.all(
                threads.map(async ({remoteId}) =>
                    normalizeRepository(
                        (await ThreadStore.loadThread(remoteId))!.exportedMessageRepository
                    )
                )
            )
        ).toEqual(before);
        expect(model.runs).toHaveLength(0);
    });

    test("history fills the available width, truncates long titles and allows scrolling without shrinking rows", async ({
        chat,
        storage
    }) => {
        const threads = buildThreadList({
            count: 24,
            idPrefix: "history-resize",
            longTitleIndex: 23
        });
        for (const thread of threads) await storage.seedThread(thread);
        const driver = await chat.mount();
        await driver.openThreadHistory();
        const rows = driver.root.getBySlot("aui_thread-list-item");
        await expect.poll(() => rows.elements().length).toBe(24);
        let wideWidth = 0;
        for (const {width, height} of COMMON_VIEWPORTS) {
            await page.viewport(width, height);
            await expect
                .poll(() => {
                    const row = rows.first().element();
                    const list = row.parentElement!;
                    const style = getComputedStyle(list);
                    const horizontalPadding =
                        Number.parseFloat(style.paddingLeft) +
                        Number.parseFloat(style.paddingRight);
                    expect(
                        Math.abs(
                            list.getBoundingClientRect().width -
                                list.parentElement!.getBoundingClientRect().width
                        )
                    ).toBeLessThanOrEqual(1);
                    expect(
                        Math.abs(
                            row.getBoundingClientRect().width -
                                (list.clientWidth - horizontalPadding)
                        )
                    ).toBeLessThanOrEqual(1);
                    expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth + 1);
                    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
                    expect(style.overflowY).toMatch(/^(auto|scroll)$/);
                    for (const item of rows.elements())
                        expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(35);
                    if (width === 1280) wideWidth = list.getBoundingClientRect().width;
                    else expect(list.getBoundingClientRect().width).toBeLessThan(wideWidth);
                    const title = rows
                        .first()
                        .getBySlot("aui_thread-list-item-title-text")
                        .element();
                    expect(getComputedStyle(title).textOverflow).toBe("ellipsis");
                    expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
                    return true;
                })
                .toBe(true);
        }
    });

    test("only the conversation receiving a reply shows a shimmering title until the reply finishes", async ({
        chat,
        storage,
        model
    }) => {
        const threads = buildThreadList({count: 2, idPrefix: "history-shimmer"});
        for (const thread of threads) await storage.seedThread(thread);
        const reached = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const answer = "Streaming history prefix complete.";
        model.respondWith([
            {
                segments: [
                    textSegment([
                        "Streaming history prefix ",
                        waitSegment(release.promise, reached.resolve),
                        "complete."
                    ])
                ]
            }
        ]);
        const driver = await chat.mount();
        await driver.openThread(threads[0].title!, `History answer [${threads[0].remoteId}]`);
        await driver.sendMessage("Continue the running history thread.");
        await reached.promise;
        await driver.openThreadHistory();
        const runningRow = driver.root
            .getBySlot("aui_thread-list-item")
            .filter({has: page.getByRole("button", {name: threads[0].title!, exact: true})});
        const idleRow = driver.root
            .getBySlot("aui_thread-list-item")
            .filter({has: page.getByRole("button", {name: threads[1].title!, exact: true})});
        const shimmer = runningRow.getBySlot("aui_thread-list-item-title-shimmer");
        await expect.element(shimmer).toBeVisible();
        await expect.element(shimmer).toHaveAttribute("aria-hidden", "true");
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
            expect(getComputedStyle(shimmer.element()).animationName).not.toBe("none");
        await expect
            .element(idleRow.getBySlot("aui_thread-list-item-title-shimmer"))
            .not.toBeInTheDocument();
        release.resolve();
        await waitForSavedConversation(threads[0].remoteId, answer);
        await expect.element(shimmer).not.toBeInTheDocument();
        expect(
            normalizeRepository(
                (await ThreadStore.loadThread(threads[1].remoteId))!.exportedMessageRepository
            )
        ).toEqual(normalizeRepository(threads[1].exportedMessageRepository));
        expect(model.runs).toHaveLength(1);
    });

    test("opening a conversation's More menu keeps it fully in view without switching conversations", async ({
        chat,
        storage,
        model
    }) => {
        const threads = buildThreadList({count: 24, idPrefix: "history-more"});
        for (const thread of threads) await storage.seedThread(thread);
        const before = await ThreadStore.listThreads();
        const driver = await chat.mount();
        await driver.openThread(threads[23].title!, `History answer [${threads[23].remoteId}]`);
        await driver.openThreadHistory();
        const row = driver.root
            .getBySlot("aui_thread-list-item")
            .filter({has: page.getByRole("button", {name: threads[0].title!, exact: true})});
        row.element().scrollIntoView({block: "end"});
        await row.hover();
        await row.getByRole("button", {name: "More options", exact: true}).click();
        const menu = page.getByRole("menu");
        await expect.element(menu).toBeVisible();
        await expect.element(menu).toBeInViewport({ratio: 1});
        for (const name of ["Rename", "Delete"]) {
            await expect.element(menu.getByRole("menuitem", {name, exact: true})).toBeVisible();
            await expect
                .element(menu.getByRole("menuitem", {name, exact: true}))
                .toBeInViewport({ratio: 1});
        }
        await userEvent.keyboard("{Escape}");
        await expect.element(menu).not.toBeInTheDocument();
        await expect
            .element(driver.root.getByRole("button", {name: "Back to thread", exact: true}))
            .toBeVisible();
        await driver.root.getByRole("button", {name: "Back to thread", exact: true}).click();
        await expect
            .element(
                driver
                    .assistantMessage(0)
                    .getByText(`History answer [${threads[23].remoteId}]`, {exact: true})
            )
            .toBeVisible();
        await chat.unmount();
        expect(await ThreadStore.listThreads()).toEqual(before);
        expect(model.runs).toHaveLength(0);
    });
});
