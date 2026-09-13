import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {CreateTagPageCommand} from "../../../../../src/core/logseq-reversible-transaction-tracker/commands/CreateTagPageCommand";

import {deletePagePermanently} from "../../../../helpers/logseq/deletePagePermanently";

const tagName = "test-create-tag-page-command";
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe("CreateTagPageCommand args", () => {
    it("requires a non-empty tag name", () => {
        expect(() => new CreateTagPageCommand({tagName: "  "})).toThrow();
        expect(new CreateTagPageCommand({tagName: " Book "}).args.tagName).toBe("Book");
    });
});

describe.skipIf(!shouldRunTests())("CreateTagPageCommand", () => {
    beforeAll(async () => {
        await deletePagePermanently(tagName);
    }, 60_000);

    afterAll(async () => {
        await deletePagePermanently(tagName);
    }, 60_000);

    // This case failure is expected. Currently, createTag does not respect uuid param.
    it("Create tag using execute() and then revert and then execute again works.", async () => {
        const command = new CreateTagPageCommand({tagName});

        const createdTag = await command.execute();
        expect(createdTag.uuid).toBe(command.tagPageUuid);
        expect(await logseq.Editor.getTag(tagName)).not.toBeNull();

        await command.revert();

        const recreatedTag = await command.execute();
        expect(recreatedTag.uuid).toBe(command.tagPageUuid);
        expect(await logseq.Editor.getTag(tagName)).not.toBeNull();
    }, 60_000);
});
