import {z} from "zod";

export const LogseqIdentitySchema = z.union([z.string(), z.number(), z.object({uuid: z.string()})]);

export const InsertBlockOptionsSchema = z
    .object({
        before: z.boolean().optional(),
        sibling: z.boolean().optional(),
        start: z.boolean().optional(),
        end: z.boolean().optional()
    })
    .optional();

export const MoveBlockOptionsSchema = z
    .object({
        before: z.boolean().optional(),
        children: z.boolean().optional()
    })
    .optional();
