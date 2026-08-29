import matter from "gray-matter";
import COMMAND_ADD_AS_ATTACHMENT_RAW from "../../chat-app/prompts/COMMAND_ADD_AS_ATTACHMENT.md?inlineSkill";
import {COMMAND_FRONTMATTER_KEYS, parseCommandFile} from "../command-parser";
import {CommandFileStore} from "../stores/command-file-store/CommandFileStore";
import type {CommandFileData} from "../stores/command-file-store/types";

const BUILT_IN_COMMAND_FILES = [COMMAND_ADD_AS_ATTACHMENT_RAW];

export const initBuiltInCommandFiles = async () => {
    const builtInCommandFileNames = new Set(
        BUILT_IN_COMMAND_FILES.map((raw) => CommandFileStore.getCommandFileNameFromContent(raw))
    );
    const existingCommandFiles = await CommandFileStore.getAllCommandFiles();

    for (const existingCommandFile of existingCommandFiles) {
        const existingFileName = CommandFileStore.getCommandFileName(existingCommandFile);
        if (existingCommandFile.builtInCommand && !builtInCommandFileNames.has(existingFileName)) {
            await CommandFileStore.deleteCommandFile(existingFileName);
        }
    }

    for (const raw of BUILT_IN_COMMAND_FILES) {
        const fileName = CommandFileStore.getCommandFileNameFromContent(raw);
        const existing = await CommandFileStore.getCommandFile(fileName);
        if (existing && !existing.builtInCommand) continue;

        const desiredContent = mergeBuiltInCommandContent(raw, existing);
        if (
            existing &&
            getComparableCommandContent(existing.content) ===
                getComparableCommandContent(desiredContent)
        ) {
            continue;
        }

        await CommandFileStore.saveCommandFile(desiredContent);
    }
};

function mergeBuiltInCommandContent(raw: string, existing: CommandFileData | null): string {
    const bundled = parseCommandFile(raw);
    if (!existing || bundled.builtInCommandUserControllable !== true) return raw;

    const parsed = matter(raw);
    parsed.data[COMMAND_FRONTMATTER_KEYS.userInvocable] = existing.userInvocable;
    return matter.stringify(parsed.content, parsed.data);
}

function getComparableCommandContent(content: string): string {
    const parsed = matter(content);
    return matter.stringify(parsed.content, parsed.data);
}
