import {createElement} from "react";
import {flushSync} from "react-dom";
import {afterEach, describe, expect, test, vi} from "vitest";
import {actWithEnvironment} from "./actWithEnvironment";
import {mountComponent} from "./mountComponent";

const environment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?: boolean};

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("actWithEnvironment", () => {
    test.each([undefined, false, true])("restores the previous flag value %s", async (value) => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", value);
        await actWithEnvironment(async () => {
            expect(environment.IS_REACT_ACT_ENVIRONMENT).toBe(true);
            await Promise.resolve();
            expect(environment.IS_REACT_ACT_ENVIRONMENT).toBe(true);
        });
        expect(environment.IS_REACT_ACT_ENVIRONMENT).toBe(value);
        expect(Object.hasOwn(environment, "IS_REACT_ACT_ENVIRONMENT")).toBe(true);
    });

    test("restores an absent flag", async () => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", undefined);
        delete environment.IS_REACT_ACT_ENVIRONMENT;
        await actWithEnvironment(() => {
            expect(environment.IS_REACT_ACT_ENVIRONMENT).toBe(true);
        });
        expect(Object.hasOwn(environment, "IS_REACT_ACT_ENVIRONMENT")).toBe(false);
    });

    test("restores the flag when React work rejects", async () => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", false);
        const error = new Error("cleanup failed");
        await expect(
            actWithEnvironment(async () => {
                throw error;
            })
        ).rejects.toBe(error);
        expect(environment.IS_REACT_ACT_ENVIRONMENT).toBe(false);
        // React retains its act queue after a rejected callback; flush it before the next test.
        await actWithEnvironment(() => {});
    });

    test("unmounts a component without act environment warnings", async () => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", undefined);
        const stderr = vi.spyOn(console, "error");
        let mounted: ReturnType<typeof mountComponent>;
        flushSync(() => {
            mounted = mountComponent(createElement("div", null, "mounted"));
        });
        expect(mounted!.container.textContent).toBe("mounted");
        await mounted!.unmount();
        expect(mounted!.container.isConnected).toBe(false);
        expect(stderr).not.toHaveBeenCalled();
        expect(environment.IS_REACT_ACT_ENVIRONMENT).toBeUndefined();
    });
});
