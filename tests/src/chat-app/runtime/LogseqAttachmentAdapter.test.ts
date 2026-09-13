import type {PageEntity} from "@logseq/libs/dist/LSPlugin";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {
    createLogseqAttachmentFromUuid,
    LOGSEQ_ATTACHMENT_TYPES
} from "../../../../src/chat-app/runtime/LogseqAttachmentAdapter";

import {deletePagePermanently} from "../../../helpers/logseq/deletePagePermanently";

const deletedPageName = "test-logseq-attachment-adapter-deleted";
const shouldRunTests = () =>
    globalThis.isLogseqAvailable === true && globalThis.isLogseqCurrentIsDBGraph === true;

describe.skipIf(!shouldRunTests())("LogseqAttachmentAdapter", () => {
    let deletedPage: PageEntity;

    beforeAll(async () => {
        await deletePagePermanently(deletedPageName);

        deletedPage = await logseq.Editor.createPage(
            deletedPageName,
            {},
            {redirect: false, createFirstBlock: false}
        );
        if (!deletedPage) deletedPage = (await logseq.Editor.getPage(deletedPageName))!;
        await logseq.Editor.deletePage(deletedPage.uuid);
    }, 60_000);

    afterAll(async () => {
        await deletePagePermanently(deletedPageName);
    }, 60_000);

    it("creates attachments for soft-deleted pages", async () => {
        const attachment = await createLogseqAttachmentFromUuid(deletedPage.uuid);

        expect(attachment.type).toBe(LOGSEQ_ATTACHMENT_TYPES.page);
        expect(attachment.content).toEqual([
            {type: "text", text: `Page UUID: ${deletedPage.uuid}\nPage Name: ${deletedPageName}`}
        ]);
    }, 60_000);

    it("rejects UUIDs that do not identify a Logseq entity", async () => {
        const missingUuid = crypto.randomUUID();

        await expect(createLogseqAttachmentFromUuid(missingUuid)).rejects.toThrow(
            `Logseq entity not found: ${missingUuid}`
        );
    }, 60_000);
});
