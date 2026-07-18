import {describe, expect, test, vi} from "vitest";
import {executeLogseqReversibleCommand} from "../../../../../src/chat-app/tools/transaction/executeLogseqReversibleCommand";
import {getLastLogseqReversibleTransactionTracker} from "../../../../../src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker";
import {BaseReversibleCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker";

vi.mock(
    "../../../../../src/chat-app/tools/transaction/getLastLogseqReversibleTransactionTracker",
    () => ({getLastLogseqReversibleTransactionTracker: vi.fn()})
);

class ToolCommand extends BaseReversibleCommand<{status: "new" | "executed"}> {
    public readonly args = {};

    public constructor() {
        super({status: "new"});
    }

    public async execute(): Promise<boolean> {
        this.commandState.status = "executed";
        return true;
    }

    public async revert(): Promise<void> {
        this.commandState.status = "new";
    }
}

describe("executeLogseqReversibleCommand", () => {
    test("adds and executes with the abort signal without reverting", async () => {
        const tracker = {
            addCommand: vi.fn(),
            execute: vi.fn().mockResolvedValue("result"),
            revertImmediately: vi.fn()
        };
        vi.mocked(getLastLogseqReversibleTransactionTracker).mockReturnValue(tracker as never);
        const controller = new AbortController();
        const command = new ToolCommand();

        const result = await executeLogseqReversibleCommand({
            command,
            signal: controller.signal
        });

        expect(tracker.addCommand).toHaveBeenCalledWith(command);
        expect(tracker.execute).toHaveBeenCalledWith({signal: controller.signal});
        expect(tracker.revertImmediately).not.toHaveBeenCalled();
        expect(result).toEqual({result: "result", tracker});
    });

    test("does not add a command when already aborted", async () => {
        const tracker = {addCommand: vi.fn(), execute: vi.fn()};
        vi.mocked(getLastLogseqReversibleTransactionTracker).mockReturnValue(tracker as never);
        const controller = new AbortController();
        controller.abort();

        await expect(
            executeLogseqReversibleCommand({command: new ToolCommand(), signal: controller.signal})
        ).rejects.toMatchObject({name: "AbortError"});
        expect(tracker.addCommand).not.toHaveBeenCalled();
    });
});
