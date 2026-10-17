import {z} from "zod";

/** Frontmatter identity only; storage filename policy is deliberately separate. */
export const commandNameSchema = z
    .string()
    .min(1)
    .refine((name) => name.trim().length > 0, "Command name must not be empty");
