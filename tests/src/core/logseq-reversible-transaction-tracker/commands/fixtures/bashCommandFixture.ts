import {test as baseTest} from "vitest";
import {VIR_ENV_USER_PATH} from "../../../../../../src/constants";
import {JustBashWrapper} from "../../../../../../src/core/just-bash-wrapper/JustBashWrapper";
import {BashCommand} from "../../../../../../src/core/logseq-reversible-transaction-tracker/commands/BashCommand";
import {LogseqReversibleTransactionTracker} from "../../../../../../src/core/logseq-reversible-transaction-tracker/LogseqReversibleTransactionTracker";
import {ToolResultStore} from "../../../../../../src/core/stores/tool-results/ToolResultStore";
import {LogseqPluginStorageManager} from "../../../../../../src/logseq/LogseqPluginStorageManager";
import {createIsolatedPluginStorage} from "../../../../../helpers/createIsolatedPluginStorage";

export const test = baseTest.extend<{
    inputPath: string;
    sandbox: {
        createCommand(
            command: string,
            cwd?: string
        ): {
            bash: BashCommand;
            tracker: LogseqReversibleTransactionTracker;
        };
        replaceTracker(
            previous: LogseqReversibleTransactionTracker,
            restored: LogseqReversibleTransactionTracker
        ): void;
    };
}>({
    inputPath: async ({sandbox}, use) => {
        void sandbox;
        await LogseqPluginStorageManager.saveFile(
            ToolResultStore.groupName,
            "input.json",
            '{"value":2}'
        );
        await use(`${VIR_ENV_USER_PATH}/tool-results/input.json`);
    },
    sandbox: async ({task}, use) => {
        void task;
        const storage = createIsolatedPluginStorage("bash-e2e");
        const trackers = new Set<LogseqReversibleTransactionTracker>();
        JustBashWrapper.resetInstanceForTesting();
        try {
            await use({
                createCommand(command, cwd) {
                    const bash = new BashCommand({command, cwd});
                    const tracker = new LogseqReversibleTransactionTracker();
                    tracker.addCommand(bash);
                    trackers.add(tracker);
                    return {bash, tracker};
                },
                replaceTracker(previous, restored) {
                    trackers.delete(previous);
                    trackers.add(restored);
                }
            });
        } finally {
            try {
                await revertTrackers(trackers);
            } finally {
                JustBashWrapper.resetInstanceForTesting();
                await storage.dispose();
            }
        }
    }
});

async function revertTrackers(trackers: ReadonlySet<LogseqReversibleTransactionTracker>) {
    const failures: unknown[] = [];
    for (const tracker of [...trackers].reverse()) {
        try {
            await tracker.revertAppliedCommands();
        } catch (error) {
            failures.push(error);
        }
    }
    if (failures.length) throw new AggregateError(failures, "Bash fixture undo failed");
}
