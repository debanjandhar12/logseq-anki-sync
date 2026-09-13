import {test as baseTest, expect} from "vitest";
import {page} from "vitest/browser";
import {formatSelectedModelId} from "../../../../src/core/ai-sdk/provider-config/selectedModelId";
import {LogseqAppInfoFetcher} from "../../../../src/logseq/LogseqAppInfoFetcher";
import {MOCK_LOGSEQ_SETTINGS} from "../../../../src/tests/constants";
import {showAIChatModal} from "../../../../src/ui/launchers/showAIChatModal";
import {createChatApp} from "../../createChatApp";
import {mountLauncher} from "../../mountLauncher";
import {type ChatDriver, createChatDriver} from "../createChatDriver";
import {createModelFixture, type ModelFixture} from "./modelFixture";
import {createStorageFixture, type StorageFixture} from "./storageFixture";
import {withScenarioSettings} from "./withScenarioSettings";

interface ChatFixture {
    mount(): Promise<ChatDriver>;
    unmount(): Promise<void>;
}

export const test = baseTest.extend<{
    storage: StorageFixture;
    model: ModelFixture;
    chat: ChatFixture;
}>({
    storage: async ({task}, use) => {
        void task;
        expect(
            globalThis.isLogseqAvailable,
            "Start the Logseq HTTP API server (LOGSEQ_API_SERVER)"
        ).toBe(true);
        expect(globalThis.isLogseqCurrentIsDBGraph, "Scenario tests require a DB graph").toBe(true);
        expect(await LogseqAppInfoFetcher.checkCurrentIsDbGraph()).toBe(true);
        const storage = createStorageFixture();
        try {
            await use(storage);
        } finally {
            await storage.dispose();
        }
    },
    model: async ({storage}, use) => {
        void storage;
        const model = createModelFixture();
        try {
            await use(model);
        } finally {
            try {
                await model.dispose();
                await model.waitForSettled();
                model.assertHealthy();
            } finally {
                model.restore();
            }
        }
    },
    chat: async ({model}, use) => {
        let mounted: Awaited<ReturnType<typeof mountLauncher>> | undefined;
        let driver: ChatDriver | undefined;
        const chat: ChatFixture = {
            async mount() {
                if (mounted) throw new Error("Chat already mounted");
                mounted = await mountLauncher(
                    showAIChatModal,
                    await createChatApp(model.chatModelAdapter)
                );
                driver = createChatDriver(mounted.container);
                await expect.element(driver.messageInput).toBeVisible();
                await expect
                    .element(
                        driver.root
                            .getByRole("combobox")
                            .filter({hasText: "Test provider / test-model"})
                    )
                    .toBeVisible();
                return driver;
            },
            async unmount() {
                try {
                    if (
                        driver?.root
                            .getByRole("button", {name: "Stop generating", exact: true})
                            .query()
                    ) {
                        await driver.root
                            .getByRole("button", {name: "Stop generating", exact: true})
                            .click();
                    }
                } finally {
                    if (mounted) {
                        await mounted.unmount();
                        mounted = undefined;
                    }
                    await model.dispose();
                    await model.waitForSettled();
                }
            }
        };
        await withScenarioSettings(
            {
                ...MOCK_LOGSEQ_SETTINGS,
                selectedModelId: formatSelectedModelId(
                    "00000000-0000-4000-8000-000000000001",
                    "test-model"
                ),
                selectedModelReasoningEffort: "medium"
            },
            async () => {
                try {
                    await use(chat);
                } finally {
                    try {
                        await chat.unmount();
                    } finally {
                        await page.viewport(1280, 720);
                    }
                }
            }
        );
    }
});
