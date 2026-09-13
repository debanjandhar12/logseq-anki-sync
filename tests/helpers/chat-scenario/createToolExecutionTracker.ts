/** Tracks original work independently of an adapter's cancellation race. */
export function createToolExecutionTracker() {
    const pending = new Set<Promise<unknown>>();
    return {
        track<T>(operation: () => Promise<T>): Promise<T> {
            const result = operation();
            pending.add(result);
            void result.then(
                () => pending.delete(result),
                () => pending.delete(result)
            );
            return result;
        },
        async waitForSettled() {
            while (pending.size) await Promise.allSettled([...pending]);
        }
    };
}
