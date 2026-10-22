import pMemoize, {
    type AnyAsyncFunction,
    pMemoizeClear as clearMemoizedCache,
    type Options
} from "p-memoize";

const memoizedFunctions = new WeakMap<AnyAsyncFunction, AnyAsyncFunction>();

/**
 * Preserve p-memoize's caching and in-flight deduplication while returning a deep
 * clone to every caller. Results must be structured-cloneable (including Sets).
 * Unsupported results reject rather than exposing the shared cached value.
 */
export default function pMemoizeWithClone<
    FunctionToMemoize extends AnyAsyncFunction,
    CacheKeyType = Parameters<FunctionToMemoize>[0]
>(fn: FunctionToMemoize, options?: Options<FunctionToMemoize, CacheKeyType>): FunctionToMemoize {
    const memoized = pMemoize(fn, options);
    const cloneOnReturn = async function (
        this: ThisParameterType<FunctionToMemoize>,
        ...arguments_: Parameters<FunctionToMemoize>
    ) {
        // Clone outside the memoized computation so misses and concurrent waiters
        // receive independent results, just like subsequent cache hits.
        return structuredClone(await memoized.apply(this, arguments_));
    } as FunctionToMemoize;

    memoizedFunctions.set(cloneOnReturn, memoized);
    return cloneOnReturn;
}

/** Clear the underlying cache, retaining p-memoize's pending-call semantics. */
export function pMemoizeClear(fn: AnyAsyncFunction): void {
    clearMemoizedCache(memoizedFunctions.get(fn) ?? fn);
}
