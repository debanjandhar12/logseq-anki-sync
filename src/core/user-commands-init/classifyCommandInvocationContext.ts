import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import {LogseqEditor} from "../../logseq/LogseqEditor";
import {getJournalDayByPageUuid} from "../logseq-reversible-transaction-tracker/commands/utils/getJournalDayByPageUuid";
import {isFlashcardBlock} from "../logseq-reversible-transaction-tracker/commands/utils/isFlashcardBlock";
import {isVideoBlock} from "../logseq-reversible-transaction-tracker/commands/utils/isVideoBlock";
import type {
    BlockCommandInvocationContext,
    BlockContextMenuInvokeLocation,
    PageCommandInvocationContext,
    PageContextMenuInvokeLocation
} from "./types";

export async function classifyBlockCommandInvocationContext(
    uuid: string
): Promise<BlockCommandInvocationContext> {
    const block = await logseq.Editor.getBlock(uuid);
    if (!block) throw new Error(`Block not found: ${uuid}`);
    if (await LogseqEditor.isPageBlock(block)) {
        throw new Error(`Page entities are excluded from block command contexts: ${uuid}`);
    }

    return {
        source: "block-context-menu",
        location: await classifyBlockLocation(block),
        uuid
    };
}

export async function classifyPageCommandInvocationContext(
    pageName: string
): Promise<PageCommandInvocationContext> {
    const page = await logseq.Editor.getPage(pageName);
    if (!page?.uuid) throw new Error(`Page not found: ${pageName}`);

    return {
        source: "page-context-menu",
        location: await classifyPageLocation(page),
        uuid: page.uuid
    };
}

async function classifyBlockLocation(block: BlockEntity): Promise<BlockContextMenuInvokeLocation> {
    if (LogseqEditor.isImageAssetBlock(block)) return "Block Context Menu/Image";
    if (LogseqEditor.isPdfAssetBlock(block)) return "Block Context Menu/Pdf";
    if (isVideoBlock(block)) return "Block Context Menu/Video";
    if (await isFlashcardBlock(block)) return "Block Context Menu/Flashcard";
    return "Block Context Menu/Other Blocks";
}

async function classifyPageLocation(page: PageEntity): Promise<PageContextMenuInvokeLocation> {
    if (await LogseqEditor.isTagBlock(page)) return "Page Context Menu/Tag";
    if (await LogseqEditor.isPropertyBlock(page)) return "Page Context Menu/Property";
    if ((await getJournalDayByPageUuid(page.uuid)) !== null) {
        return "Page Context Menu/Journal";
    }
    return "Page Context Menu/Other Pages";
}
