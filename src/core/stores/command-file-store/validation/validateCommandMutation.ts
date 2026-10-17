import matter from "gray-matter";
import {COMMAND_FRONTMATTER_KEYS, parseCommandFile} from "../../../command-parser";

/** Shared user-edit policy; bundled installers intentionally use the trusted store API. */
export function validateCommandMutation(
    originalSource: string | undefined,
    nextSource: string | undefined
): string | null {
    const original = originalSource === undefined ? undefined : parseCommandFile(originalSource);
    const next = nextSource === undefined ? undefined : parseCommandFile(nextSource);
    if (!original?.builtInCommand) {
        return next?.builtInCommand || next?.builtInCommandUserControllable
            ? "User operations cannot create built-in commands."
            : null;
    }
    if (!next) return "built-in commands cannot be deleted.";
    const originalMatter = matter(originalSource!, {});
    const nextMatter = matter(nextSource!, {});
    const originalMetadata = {...originalMatter.data};
    const nextMetadata = {...nextMatter.data};
    if (original.builtInCommandUserControllable) {
        delete originalMetadata[COMMAND_FRONTMATTER_KEYS.userInvocable];
        delete nextMetadata[COMMAND_FRONTMATTER_KEYS.userInvocable];
    }
    return next.builtInCommand &&
        originalMatter.content === nextMatter.content &&
        JSON.stringify(originalMetadata) === JSON.stringify(nextMetadata)
        ? null
        : "built-in commands are read-only except for an explicitly controllable Enabled setting.";
}
