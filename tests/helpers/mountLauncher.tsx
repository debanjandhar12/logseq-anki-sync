import {act} from "react";
import {vi} from "vitest";
import {UI} from "../../src/ui/UI";

export async function mountLauncher<T extends (...args: any[]) => Promise<any>>(
    launcher: T,
    ...args: Parameters<T>
): Promise<{
    container: HTMLElement | ShadowRoot;
    result: ReturnType<T>;
    unmount: () => Promise<void>;
}> {
    UI._resetForTesting();
    document.body.innerHTML = '<div id="app"></div>';

    const result = launcher(...args) as ReturnType<T>;
    await vi.waitFor(() => {
        if (!document.querySelector<HTMLElement>('[id^="modal-"]')) {
            throw new Error("Launcher has not mounted its modal yet");
        }
    });

    const container = document.querySelector<HTMLElement>('[id^="modal-"]');
    if (!container) throw new Error("Launcher did not mount a modal");

    return {
        container,
        result,
        unmount: async () => {
            await act(async () => UI._resetForTesting());
        }
    };
}
