// @vitest-environment node
import {describe, expect, it, vi} from "vitest";
import {waitForPromiseOrAbort} from "../waitForPromiseOrAbort";

describe("waitForPromiseOrAbort", () => {
    it.each([
        "resolve",
        "reject",
        "abort"
    ] as const)("removes its abort listener on %s", async (settlement) => {
        const deferred = Promise.withResolvers<number>();
        const controller = new AbortController();
        const add = vi.spyOn(controller.signal, "addEventListener");
        const remove = vi.spyOn(controller.signal, "removeEventListener");
        const pending = waitForPromiseOrAbort(deferred.promise, controller.signal);
        const error = new Error("failed wait");
        if (settlement === "resolve") {
            deferred.resolve(42);
            await expect(pending).resolves.toBe(42);
        } else if (settlement === "reject") {
            deferred.reject(error);
            await expect(pending).rejects.toBe(error);
        } else {
            controller.abort("custom abort reason");
            await expect(pending).rejects.toMatchObject({name: "AbortError"});
            // The original promise can reject later without an unhandled rejection.
            deferred.reject(error);
            await Promise.resolve();
        }
        expect(add).toHaveBeenCalledOnce();
        expect(remove).toHaveBeenCalledWith("abort", add.mock.calls[0][1]);
    });

    it("immediately rejects an already-aborted signal without registering a listener", async () => {
        const controller = new AbortController();
        controller.abort(new Error("custom reason"));
        const add = vi.spyOn(controller.signal, "addEventListener");
        await expect(
            waitForPromiseOrAbort(Promise.reject(new Error("late rejection")), controller.signal)
        ).rejects.toMatchObject({name: "AbortError"});
        expect(add).not.toHaveBeenCalled();
    });

    it("keeps the first settlement when abort and release race", async () => {
        const controller = new AbortController();
        const deferred = Promise.withResolvers<number>();
        const pending = waitForPromiseOrAbort(deferred.promise, controller.signal);
        deferred.resolve(1);
        controller.abort();
        await expect(pending).rejects.toMatchObject({name: "AbortError"});
    });
});
