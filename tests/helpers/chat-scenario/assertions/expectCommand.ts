import {expect} from "vitest";
import {CommandFileStore} from "../../../../src/core/stores/command-file-store/CommandFileStore";

export async function expectCommand(name: string, content: string) {
    await expect
        .poll(async () => (await CommandFileStore.getCommandFileByName(name))?.content)
        .toBe(content);
}
