import {act} from "react";

/** Flush explicit React work without enabling act warnings for browser interactions. */
export async function actWithEnvironment(callback: () => void | Promise<void>): Promise<void> {
    const environment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?: boolean};
    const hadEnvironmentFlag = Object.hasOwn(environment, "IS_REACT_ACT_ENVIRONMENT");
    const previousEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;
    environment.IS_REACT_ACT_ENVIRONMENT = true;
    try {
        await act(callback);
    } finally {
        if (hadEnvironmentFlag) {
            environment.IS_REACT_ACT_ENVIRONMENT = previousEnvironment;
        } else {
            delete environment.IS_REACT_ACT_ENVIRONMENT;
        }
    }
}
