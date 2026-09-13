import {completionStatus} from "@codemirror/autocomplete";
import {expect} from "vitest";
import type {CodeMirrorDriver} from "../createCodeMirrorDriver";

export async function expectFrontmatterCompletionSuppressed(
    driver: CodeMirrorDriver,
    position: number
): Promise<void> {
    const view = driver.view();
    await expect.poll(() => completionStatus(view.state)).toBeNull();
    expect(view.state.doc.sliceString(position, position + 2)).toBe("<%");
    await expect.element(driver.completionListbox).not.toBeInTheDocument();
}
