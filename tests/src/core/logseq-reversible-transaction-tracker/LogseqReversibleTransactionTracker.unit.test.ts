import {describe, expect, test, vi} from "vitest";
import {
    BaseReversibleCommand,
    LogseqReversibleTransactionTracker
} from "../../../../src/core/logseq-reversible-transaction-tracker";

class TestCommand extends BaseReversibleCommand<{status: "new" | "executed"}> {
    public readonly args = {};
    public executeCount = 0;
    public revertCount = 0;

    public constructor(
        private readonly mutation: boolean,
        private readonly label: string,
        private readonly events: string[] = []
    ) {
        super({status: "new"});
    }

    public async execute(): Promise<boolean> {
        this.assertCanExecute();
        this.executeCount += 1;
        this.events.push(`execute:${this.label}`);
        this.commandState.status = "executed";
        this.changedPages.push(this.label);
        return true;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        this.revertCount += 1;
        this.events.push(`revert:${this.label}`);
        this.commandState.status = "new";
    }

    public override isGraphMutation(): boolean {
        return this.mutation;
    }
}

describe("LogseqReversibleTransactionTracker", () => {
    test("executes incrementally and reverts only the applied prefix", async () => {
        vi.useFakeTimers();
        const events: string[] = [];
        const first = new TestCommand(true, "first", events);
        const second = new TestCommand(true, "second", events);
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(first);

        const firstRun = tracker.execute();
        await vi.runAllTimersAsync();
        await firstRun;
        tracker.addCommand(second);
        const secondRun = tracker.execute();
        await vi.runAllTimersAsync();
        await secondRun;

        expect(first.executeCount).toBe(1);
        expect(second.executeCount).toBe(1);
        expect(tracker.getAppliedCommandCount()).toBe(2);
        expect(tracker.getChangedPages()).toEqual(["first", "second"]);

        await tracker.revertImmediately();
        expect(events.slice(-2)).toEqual(["revert:second", "revert:first"]);
        expect(tracker.getAppliedCommandCount()).toBe(0);
        vi.useRealTimers();
    });

    test("classifies applied read-only queues separately from graph mutations", async () => {
        vi.useFakeTimers();
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new TestCommand(false, "read"));
        const execution = tracker.execute();
        await vi.runAllTimersAsync();
        await execution;

        expect(tracker.getAppliedCommandCount()).toBe(1);
        expect(tracker.hasAppliedGraphMutations()).toBe(false);
        vi.useRealTimers();
    });

    test("checks abort signals before starting commands", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        const command = new TestCommand(true, "aborted");
        tracker.addCommand(command);
        const controller = new AbortController();
        controller.abort();

        await expect(tracker.execute({signal: controller.signal})).rejects.toMatchObject({
            name: "AbortError"
        });
        expect(command.executeCount).toBe(0);
    });
});
