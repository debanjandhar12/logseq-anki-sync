/** Await a promise without leaving an abort listener behind after settlement. */
export function waitForPromiseOrAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => {
            signal.removeEventListener("abort", onAbort);
            reject(new DOMException("The operation was aborted", "AbortError"));
        };

        // Observe rejection even when the signal was already aborted.
        promise.then(
            (value) => {
                signal.removeEventListener("abort", onAbort);
                resolve(value);
            },
            (error) => {
                signal.removeEventListener("abort", onAbort);
                reject(error);
            }
        );
        if (signal.aborted) {
            onAbort();
        } else {
            signal.addEventListener("abort", onAbort, {once: true});
        }
    });
}
