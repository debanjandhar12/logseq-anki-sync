import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {
    createLogseqBlockAttachment,
    LOGSEQ_BLOCK_ATTACHMENT_CONTENT_TYPE,
    LOGSEQ_BLOCK_ATTACHMENT_TYPE,
    LogseqBlockAttachmentAdapter
} from "src/chat-app/runtime/LogseqBlockAttachmentAdapter";
import {describe, expect, it} from "vitest";

describe("LogseqBlockAttachmentAdapter", () => {
    it("creates a complete attachment from a Logseq block tree", () => {
        const attachment = createLogseqBlockAttachment({
            uuid: "parent-uuid",
            content: "Parent",
            children: [
                {
                    uuid: "child-uuid",
                    content: "Child"
                }
            ]
        } as BlockEntity);

        expect(attachment).toMatchObject({
            id: "logseq-block:parent-uuid",
            type: LOGSEQ_BLOCK_ATTACHMENT_TYPE,
            name: "Logseq block: Parent",
            contentType: LOGSEQ_BLOCK_ATTACHMENT_CONTENT_TYPE
        });
        expect(attachment.content).toEqual([
            {
                type: "text",
                text: '<logseq-block uuid="parent-uuid">\n- Parent\n  - Child\n</logseq-block>'
            }
        ]);
    });

    it("converts pending Logseq block files into model-visible text", async () => {
        const file = new File(
            [JSON.stringify({uuid: "block-uuid", content: "- Block"})],
            "block.json",
            {
                type: LOGSEQ_BLOCK_ATTACHMENT_CONTENT_TYPE
            }
        );
        const adapter = new LogseqBlockAttachmentAdapter();
        const pending = await adapter.add({file});
        const complete = await adapter.send(pending);

        expect(complete).toMatchObject({
            type: LOGSEQ_BLOCK_ATTACHMENT_TYPE,
            name: "block.json",
            contentType: LOGSEQ_BLOCK_ATTACHMENT_CONTENT_TYPE,
            status: {type: "complete"}
        });
        expect(complete.content).toEqual([
            {
                type: "text",
                text: '<logseq-block uuid="block-uuid">\n- Block\n</logseq-block>'
            }
        ]);
    });
});
