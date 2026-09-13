import {expect} from "vitest";
import type {CodeMirrorDriver} from "../createCodeMirrorDriver";

export async function expectCompletionOptions(
    driver: CodeMirrorDriver,
    labels: readonly string[]
): Promise<void> {
    for (const label of labels) {
        await expect.element(driver.completionOption(label)).toBeVisible();
    }
}
