import {isPageSoftDeleted} from "../../../../src/core/logseq-reversible-transaction-tracker/commands/utils/isPageSoftDeleted";

export function createLogseqCleanupFixture() {
    const pageNames = new Set<string>();
    const operations: Array<() => Promise<void>> = [];
    return {
        pageNames,
        add(operation: () => Promise<void>) {
            operations.push(operation);
        },
        async dispose() {
            const errors: unknown[] = [];
            for (const operation of operations.reverse()) {
                try {
                    await operation();
                } catch (error) {
                    errors.push(error);
                }
            }
            for (const name of pageNames) {
                try {
                    const page = await logseq.Editor.getPage(name);
                    if (page && !isPageSoftDeleted(page)) await logseq.Editor.deletePage(page.uuid);
                } catch (error) {
                    errors.push(error);
                }
            }
            if (errors.length) throw new AggregateError(errors, "Scenario graph cleanup failed");
        }
    };
}
export type LogseqCleanupFixture = ReturnType<typeof createLogseqCleanupFixture>;
