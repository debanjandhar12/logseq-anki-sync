import pTimeout from "p-timeout";
import {vi} from "vitest";

type AsyncMethod = (...args: any[]) => Promise<any>;
type AsyncMethodKeys<T> = {
    [K in keyof T]: T[K] extends AsyncMethod ? K : never;
}[keyof T];
export interface ObservedToolCall<F extends AsyncMethod, Snapshot> {
    ordinal: number;
    args: Parameters<F>;
    snapshot: Snapshot;
    state: "entered" | "fulfilled" | "rejected";
    result?: Awaited<ReturnType<F>>;
    error?: unknown;
}

/** Observe real async methods, including work outliving an adapter's abort race. */
export function createToolPassthroughSpy<
    T extends object,
    K extends AsyncMethodKeys<T>,
    Snapshot = undefined
>(
    target: T,
    method: K,
    options: {
        snapshot?: (args: Parameters<Extract<T[K], AsyncMethod>>, receiver: T) => Snapshot;
        beforeCall?: (
            call: ObservedToolCall<Extract<T[K], AsyncMethod>, Snapshot>,
            shutdownSignal: AbortSignal
        ) => Promise<void>;
    } = {}
) {
    type Method = Extract<T[K], AsyncMethod>;
    const original = target[method] as Method;
    const shutdown = new AbortController();
    const pending = new Set<Promise<unknown>>();
    const calls: ObservedToolCall<Method, Snapshot>[] = [];
    const events: {ordinal: number; phase: "start" | "end"}[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    // Vitest cannot infer its conditional method keys through our async-only key constraint.
    const spy = vi.spyOn(target as Record<PropertyKey, AsyncMethod>, method as PropertyKey);
    spy.mockImplementation(function (this: T, ...args: Parameters<Method>) {
        const call: ObservedToolCall<Method, Snapshot> = {
            ordinal: calls.length + 1,
            args,
            snapshot: options.snapshot?.(args, this) as Snapshot,
            state: "entered"
        };
        calls.push(call);
        events.push({ordinal: call.ordinal, phase: "start"});
        maxInFlight = Math.max(maxInFlight, ++inFlight);
        const operation = (async () => {
            try {
                shutdown.signal.throwIfAborted();
                if (options.beforeCall) {
                    await pTimeout(options.beforeCall(call, shutdown.signal), {
                        milliseconds: Infinity,
                        signal: shutdown.signal
                    });
                }
                shutdown.signal.throwIfAborted();
                const result = await original.apply(this, args);
                call.result = result;
                call.state = "fulfilled";
                return result;
            } catch (error) {
                call.error = error;
                call.state = "rejected";
                throw error;
            } finally {
                inFlight--;
                events.push({ordinal: call.ordinal, phase: "end"});
            }
        })();
        pending.add(operation);
        void operation.then(
            () => pending.delete(operation),
            () => pending.delete(operation)
        );
        return operation;
    });
    return {
        calls,
        events,
        get maxInFlight() {
            return maxInFlight;
        },
        async waitForSettled() {
            while (pending.size) await Promise.allSettled([...pending]);
        },
        async dispose() {
            shutdown.abort();
            while (pending.size) await Promise.allSettled([...pending]);
        },
        restore() {
            if (pending.size) throw new Error("Settle original method calls before restoring spy");
            spy.mockRestore();
        }
    };
}
