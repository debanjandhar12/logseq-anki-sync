import {z} from "zod";

/**
 * Validates the complete generated filename, including its `.md` suffix.
 * Check the identity as well: appending `.md` must not hide traversal identities,
 * surrounding whitespace, or a trailing dot/space. Case collisions belong to callers.
 */
export const commandFileNameSchema = z.string().refine((fileName) => {
    if (!fileName.endsWith(".md")) return false;
    const name = fileName.slice(0, -3);
    return (
        name.length > 0 &&
        name.trim() === name &&
        name !== "." &&
        name !== ".." &&
        !/[<>:"/\\|?*]/.test(fileName) &&
        Array.from(fileName).every(
            (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127
        ) &&
        !/[. ]$/.test(name)
    );
}, "Command name must be a valid simple name, not a path");
