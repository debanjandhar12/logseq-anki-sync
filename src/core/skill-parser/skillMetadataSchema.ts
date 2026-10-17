import {z} from "zod";
import {skillNameSchema} from "./skillNameSchema";

// Retain the original import path for callers of the combined metadata schema.
export {skillNameSchema} from "./skillNameSchema";

export const skillDescriptionSchema = z
    .string()
    .max(1024)
    .refine((value) => value.trim().length > 0, "Skill description must not be empty");

export const skillMetadataSchema = z.object({
    name: skillNameSchema,
    description: skillDescriptionSchema
});
