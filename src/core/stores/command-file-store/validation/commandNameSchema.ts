import {z} from "zod";

/** A command identity, not a filename or filesystem path. */
export const commandNameSchema = z
    .string()
    .min(1)
    .refine(
        (name) =>
            name.trim() === name &&
            name !== "." &&
            name !== ".." &&
            !/[<>:"/\\|?*]/.test(name) &&
            Array.from(name).every(
                (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127
            ) &&
            !/[. ]$/.test(name),
        "Command name must be a valid simple name, not a path"
    );
