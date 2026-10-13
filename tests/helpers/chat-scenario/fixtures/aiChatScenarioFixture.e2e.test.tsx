import {describe, expect} from "vitest";
import {ThreadStore} from "../../../../src/core/stores/thread-store/ThreadStore";
import {textSegment} from "../../mock-language-model/builders/textSegment";
import {waitSegment} from "../../mock-language-model/builders/waitSegment";
import {test} from "./aiChatScenarioFixture";

describe("Scenario fixture lifecycle", () => {
    test("unmount cancels a held stream and late release cannot continue it", async ({
        chat,
        model
    }) => {
        const reached = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const languageModel = model.respondWith([
            {
                segments: [
                    textSegment([
                        "Partial response",
                        waitSegment(release.promise, reached.resolve),
                        " must not appear"
                    ])
                ]
            }
        ]);
        const driver = await chat.mount();
        await driver.sendMessage("Start a controlled response");
        await reached.promise;
        await expect
            .element(driver.assistantMessage(0).getByText("Partial response", {exact: true}))
            .toBeVisible();
        await chat.unmount();
        await chat.unmount();
        const [thread] = await ThreadStore.listThreads();
        await expect
            .poll(async () => {
                const repository = (await ThreadStore.loadThread(thread.remoteId))
                    ?.exportedMessageRepository;
                const last = repository?.messages.find(
                    ({message}) => message.id === repository.headId
                )?.message;
                return last?.role === "assistant" ? last.status : null;
            })
            .toMatchObject({type: "incomplete", reason: "cancelled"});
        const before = await ThreadStore.loadThread(thread.remoteId);
        release.resolve();
        await model.waitForSettled();
        expect(await ThreadStore.loadThread(thread.remoteId)).toEqual(before);
        expect(languageModel.doStreamCalls).toHaveLength(1);
        languageModel.assertHealthy();
    });

    test("the next fixture has no prior thread or title state", async ({chat, model}) => {
        expect(await ThreadStore.listThreads()).toEqual([]);
        model.respondWith([{segments: [textSegment("Fresh response")]}]);
        const driver = await chat.mount();
        await driver.sendMessage("Fresh question");
        await expect
            .element(driver.assistantMessage(0).getByText("Fresh response", {exact: true}))
            .toBeVisible();
        await expect.poll(async () => (await ThreadStore.listThreads()).length).toBe(1);
    });
});
