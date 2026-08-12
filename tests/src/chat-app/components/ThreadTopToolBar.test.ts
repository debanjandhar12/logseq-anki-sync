import {describe, expect, test} from "vitest";
import {isThreadChatActionEnabled} from "../../../../src/chat-app/components/ThreadTopToolBar";

describe("ThreadTopToolBar", () => {
    test.each([
        ["new", undefined, 0, false, false],
        ["new", "thread-1", 1, false, false],
        ["regular", undefined, 1, false, false],
        ["regular", "thread-1", 0, false, false],
        ["regular", "thread-1", 1, false, true],
        ["regular", "thread-1", 1, true, false],
        ["deleted", "thread-1", 1, false, false]
    ])("checks status=%s, id=%s, messages=%i, busy=%s", (status, threadId, messageCount, isBusy, expected) => {
        expect(
            isThreadChatActionEnabled(status as string, threadId as string, messageCount, isBusy)
        ).toBe(expected);
    });
});
