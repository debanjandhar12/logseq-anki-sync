import {describe, expect, vi} from "vitest";
import {App} from "../../../src/chat-app/App";
import {showAIChatModal} from "../../../src/ui/launchers/showAIChatModal";
import {
    findInShadowTree,
    getTextContentInShadowTree,
    mountLauncher
} from "../../helpers/mountLauncher";
import {test} from "./fixture";

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
            const mockTurn = languageModel.doStreamCalls;
            const mounted = await mountLauncher(
                showAIChatModal,
                <App chatModelAdapter={model.chatModelAdapter} />
            );

            try {
                await annotate("Initial chat modal mounted");

                const input = findInShadowTree<HTMLTextAreaElement>(
                    mounted.container,
                    '[aria-label="Message input"]'
                );
                if (!input) throw new Error("Message input was not mounted");
                const setValue = Object.getOwnPropertyDescriptor(
                    HTMLTextAreaElement.prototype,
                    "value"
                )?.set;
                setValue?.call(input, `Create a page named ${pageName}`);
                input.dispatchEvent(new Event("input", {bubbles: true}));

                const sendButton = findInShadowTree<HTMLButtonElement>(
                    mounted.container,
                    '[aria-label="Send message"]'
                );
                if (!sendButton) throw new Error("Send button was not mounted");
                sendButton.click();

                await vi.waitFor(async () => {
                    expect(languageModel.doStreamCalls).toHaveLength(1);
                });
                await annotate("Tool call streamed");

                await expect
                    .poll(() => {
                        if (mockTurn.length !== 2) return false;
                        return getTextContentInShadowTree(mounted.container).includes(
                            "Page created"
                        );
                    })
                    .toBe(true);
                await annotate("Follow-up response rendered");
            } finally {
                await mounted.unmount();
            }
        }
    );
});
