import {describe, expect} from "vitest";
import {page} from "vitest/browser";
import {showAIChatModal} from "../../../src/ui/launchers/showAIChatModal";
import {test} from "../../helpers/aiChatScenarioFixture";
import {createChatApp} from "../../helpers/createChatApp";
import {mountLauncher} from "../../helpers/mountLauncher";

describe("showAIChatModal", () => {
    test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
        "creates a page and displays the follow-up response",
        async ({annotate, model}) => {
            const pageName = `scenario-test-${crypto.randomUUID()}`;
            const languageModel = model.respondWith([
                {
                    type: "tool-call",
                    toolCallId: "create-page-1",
                    toolName: "logseq_create_page",
                    input: {pageName}
                },
                {type: "text", text: "Page created"}
            ]);
            const mounted = await mountLauncher(
                showAIChatModal,
                await createChatApp(model.chatModelAdapter)
            );

            try {
                await annotate("Initial chat modal mounted");

                await page
                    .getByRole("textbox", {name: "Message input", exact: true})
                    .fill(`Create a page named ${pageName}`);
                await page.getByRole("button", {name: "Send message", exact: true}).click();

                await expect
                    .poll(() => languageModel.doStreamCalls.length)
                    .toBeGreaterThanOrEqual(1);
                await annotate("Tool call streamed");

                await expect.poll(() => languageModel.doStreamCalls.length).toBe(2);
                await expect.element(page.getByText("Page created", {exact: true})).toBeVisible();
                await model.waitForTitleGeneration();
                await annotate("Follow-up response rendered");
            } finally {
                await mounted.unmount();
            }
        }
    );
});
