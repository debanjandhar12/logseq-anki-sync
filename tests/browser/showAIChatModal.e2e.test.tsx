import {beforeEach, describe, expect, test, vi} from "vitest";
import {App} from "../../src/chat-app/App";
import {showAIChatModal} from "../../src/ui/launchers/showAIChatModal";
import {createMultiTurnMockLanguageModel} from "../helpers/mockLanguageModel";
import {
    findInShadowTree,
    getTextContentInShadowTree,
    mountLauncher
} from "../helpers/mountLauncher";

const {createLLMModelMock} = vi.hoisted(() => ({createLLMModelMock: vi.fn()}));
const LOGSEQ_TOOL_TIMEOUT_MS = 10_000;
const pageName = `browser-test-${crypto.randomUUID()}`;
const model = createMultiTurnMockLanguageModel([
    {
        type: "tool-call",
        toolCallId: "create-page-1",
        toolName: "logseq_create_page",
        input: {pageName}
    },
    {type: "text", text: "Page created"}
]);
createLLMModelMock.mockReturnValue(model);

vi.mock("../../src/core/ai-sdk/getLLMModel", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../src/core/ai-sdk/getLLMModel")>()),
    createLLMModel: createLLMModelMock
}));
describe("showAIChatModal", () => {
    beforeEach(() => {
        model.doStreamCalls.length = 0;
        createLLMModelMock.mockClear();
    });

    test.skipIf(!globalThis.isLogseqAvailable || !globalThis.isLogseqCurrentIsDBGraph)(
        "creates a page and displays the follow-up response",
        async ({annotate}) => {
            const mockTurn = model.doStreamCalls;
            const mounted = await mountLauncher(showAIChatModal, <App />);
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
                expect(model.doStreamCalls).toHaveLength(1);
            });
            await annotate("Tool call streamed");

            await vi.waitFor(
                () => {
                    expect(mockTurn).toHaveLength(2);
                    expect(getTextContentInShadowTree(mounted.container)).toContain("Page created");
                },
                {timeout: LOGSEQ_TOOL_TIMEOUT_MS}
            );
            await annotate("Follow-up response rendered");

            expect(createLLMModelMock).toHaveBeenCalled();
            await mounted.unmount();
        }
    );
});
